// Command savolbor runs a lan-only live q&a board for workshops.
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/skip2/go-qrcode"

	"savolbor/qna"
	"savolbor/server"
	"savolbor/store"
	"savolbor/web"
)

type options struct {
	port      int
	data      string
	debug     bool
	publicURL string
	wifi      string
	noOpen    bool
	demo      bool
}

func parseOptions(args []string) (*options, error) {
	o := &options{}
	fs := flag.NewFlagSet("savolbor", flag.ContinueOnError)
	fs.IntVar(&o.port, "port", 8080, "port to listen on")
	fs.StringVar(&o.data, "data", "savolbor-"+time.Now().Format("2006-01-02")+".jsonl", "event log file")
	fs.BoolVar(&o.debug, "debug", false, "log every request (use when phones can't connect)")
	fs.StringVar(&o.publicURL, "public-url", "", "public tunnel url (e.g. https://x.trycloudflare.com); presenter then always needs the key")
	fs.StringVar(&o.wifi, "wifi", "", "wi-fi name to show under the qr, so phones on mobile data notice")
	fs.BoolVar(&o.noOpen, "no-open", false, "do not open the presenter page in the browser on start")
	fs.BoolVar(&o.demo, "demo", false, "start with sample questions in a throwaway log, to try it out")
	if err := fs.Parse(args); err != nil {
		return nil, err
	}
	dataSet := false
	fs.Visit(func(f *flag.Flag) { dataSet = dataSet || f.Name == "data" })
	if o.demo && !dataSet {
		o.data = demoLog()
	}
	return o, nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "savolbor:", err)
		os.Exit(1)
	}
}

func run() error {
	o, err := parseOptions(os.Args[1:])
	if errors.Is(err, flag.ErrHelp) {
		return nil // usage was already printed
	}
	if err != nil {
		return err
	}
	if o.debug {
		slog.SetLogLoggerLevel(slog.LevelDebug)
	}

	if o.demo && o.data == demoLog() {
		os.Remove(o.data) // the demo starts fresh every time
	}
	log, events, err := store.Open(o.data)
	if err != nil {
		return fmt.Errorf("open data file: %w", err)
	}
	defer log.Close()
	board := qna.NewBoard(log.Append, time.Now)
	for _, e := range events {
		if err := board.Apply(e); err != nil {
			slog.Warn("skipping event on replay", "type", e.Type, "qid", e.QID, "err", err)
		}
	}
	if o.demo && len(events) == 0 {
		if err := seedDemo(board); err != nil {
			return fmt.Errorf("demo questions: %w", err)
		}
	}
	restored := len(board.View("", true).Questions)

	key := make([]byte, 8)
	if _, err := rand.Read(key); err != nil {
		return err
	}
	adminKey := hex.EncodeToString(key)

	ifaces := lanInterfaces()
	best, all := pickLANIP(ifaces)
	lanHost := "localhost"
	if best != nil {
		lanHost = best.String()
	}
	joinURL := fmt.Sprintf("http://%s:%d", lanHost, o.port)
	public := o.publicURL != ""
	if public {
		if !strings.HasPrefix(o.publicURL, "https://") && !strings.HasPrefix(o.publicURL, "http://") {
			return fmt.Errorf("-public-url must start with https:// (got %q)", o.publicURL)
		}
		joinURL = strings.TrimRight(o.publicURL, "/")
	}

	static, err := fs.Sub(web.Dist, "dist")
	if err != nil {
		return err
	}
	app := server.New(server.Config{Board: board, AdminKey: adminKey, JoinURL: joinURL, Static: static, Public: public, Wifi: o.wifi})
	var handler http.Handler = app
	if o.debug {
		handler = logRequests(handler)
	}

	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", o.port))
	if err != nil {
		if errors.Is(err, syscall.EADDRINUSE) {
			return fmt.Errorf("port %d is already in use — stop the other program or pass -port", o.port)
		}
		return err
	}

	// cancelling base ends every request context, so open sse streams return
	base, stop := context.WithCancel(context.Background())
	defer stop()
	srv := &http.Server{
		Handler:           handler,
		BaseContext:       func(net.Listener) context.Context { return base },
		ReadHeaderTimeout: 10 * time.Second,
	}

	printBanner(restored, o.data, joinURL, o.port, adminKey, ifaces, all, public, o.wifi)
	if o.debug {
		fmt.Println("  debug: logging every request. no log line when a phone connects = it never reached this laptop")
		fmt.Println()
	}

	if !public {
		go watchJoinURL(base, 5*time.Second, joinURL, func() string { return joinURLFor(o.port) }, func(u string) {
			app.SetJoinURL(u)
			fmt.Printf("\nnetwork changed — participants now join at %s\n  presenter (phone): %s/host?key=%s\n\n", u, u, adminKey)
			if qr, err := qrcode.New(u, qrcode.Medium); err == nil {
				fmt.Println(qr.ToSmallString(false))
			}
		})
	}

	errc := make(chan error, 1)
	go func() { errc <- srv.Serve(ln) }()
	if !o.noOpen {
		if err := openBrowser(presenterURL(o.port, adminKey, public)); err != nil {
			slog.Warn("could not open the browser; open the presenter url above by hand", "err", err)
		}
	}
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	select {
	case err := <-errc:
		return err
	case <-sig:
	}
	fmt.Println("\nstopping…")
	stop()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return srv.Shutdown(ctx)
}

func printBanner(restored int, data, joinURL string, port int, adminKey string, ifaces []ifaceAddrs, all []net.IP, public bool, wifi string) {
	fmt.Printf("savolbor is running — %d questions restored from %s\n\n", restored, data)
	fmt.Printf("  participants:      %s\n", joinURL)
	if public {
		fmt.Printf("  presenter:         http://localhost:%d/host?key=%s\n", port, adminKey)
	} else {
		fmt.Printf("  presenter:         http://localhost:%d/host\n", port)
	}
	fmt.Printf("  presenter (phone): %s/host?key=%s\n", joinURL, adminKey)
	fmt.Print(wifiLine(wifi))
	fmt.Println()
	if qr, err := qrcode.New(joinURL, qrcode.Medium); err == nil {
		fmt.Println(qr.ToSmallString(false))
	}
	if public {
		fmt.Println("  public mode: anyone with the url can ask — stop the tunnel after the workshop")
		return
	}
	if len(all) == 0 {
		fmt.Println("  no lan address found — connect to wi-fi or turn on a hotspot, then restart")
	}
	if len(all) > 1 {
		var others []string
		for _, ip := range all[1:] {
			others = append(others, fmt.Sprintf("%s (%s)", ip, ifaceOf(ifaces, ip)))
		}
		fmt.Printf("  other addresses: %s\n", strings.Join(others, ", "))
	}
}

// wifiLine is the banner line naming the wi-fi phones must join; empty when -wifi is not set.
func wifiLine(ssid string) string {
	if ssid == "" {
		return ""
	}
	return fmt.Sprintf("  wi-fi:             %s\n", ssid)
}

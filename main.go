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

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "savolbor:", err)
		os.Exit(1)
	}
}

func run() error {
	port := flag.Int("port", 8080, "port to listen on")
	data := flag.String("data", "savolbor-"+time.Now().Format("2006-01-02")+".jsonl", "event log file")
	flag.Parse()

	log, events, err := store.Open(*data)
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
	joinURL := fmt.Sprintf("http://%s:%d", lanHost, *port)

	static, err := fs.Sub(web.Static, "static")
	if err != nil {
		return err
	}
	handler := server.New(server.Config{Board: board, AdminKey: adminKey, JoinURL: joinURL, Static: static})

	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", *port))
	if err != nil {
		if errors.Is(err, syscall.EADDRINUSE) {
			return fmt.Errorf("port %d is already in use — stop the other program or pass -port", *port)
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

	printBanner(restored, *data, joinURL, *port, adminKey, ifaces, all)

	errc := make(chan error, 1)
	go func() { errc <- srv.Serve(ln) }()
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

func printBanner(restored int, data, joinURL string, port int, adminKey string, ifaces []ifaceAddrs, all []net.IP) {
	fmt.Printf("savolbor is running — %d questions restored from %s\n\n", restored, data)
	fmt.Printf("  participants:      %s\n", joinURL)
	fmt.Printf("  presenter:         http://localhost:%d/host\n", port)
	fmt.Printf("  presenter (phone): %s/host?key=%s\n\n", joinURL, adminKey)
	if qr, err := qrcode.New(joinURL, qrcode.Medium); err == nil {
		fmt.Println(qr.ToSmallString(false))
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

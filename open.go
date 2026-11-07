package main

import (
	"fmt"
	"os/exec"
	"runtime"
)

// openCommand is the command that opens url in the default browser on goos.
func openCommand(goos, url string) (string, []string) {
	switch goos {
	case "darwin":
		return "open", []string{url}
	case "windows":
		return "rundll32", []string{"url.dll,FileProtocolHandler", url}
	default:
		return "xdg-open", []string{url}
	}
}

// presenterURL is the page the presenter's own browser opens. In public mode
// localhost is not trusted as host, so the link carries the key.
func presenterURL(port int, adminKey string, public bool) string {
	u := fmt.Sprintf("http://localhost:%d/host", port)
	if public {
		u += "?key=" + adminKey
	}
	return u
}

// openBrowser starts the default browser without waiting for it.
func openBrowser(url string) error {
	name, args := openCommand(runtime.GOOS, url)
	cmd := exec.Command(name, args...)
	if err := cmd.Start(); err != nil {
		return err
	}
	go cmd.Wait() // reap the child
	return nil
}

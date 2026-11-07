package server

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"net"
	"net/http"
)

const (
	deviceCookie = "savolbor_device"
	hostCookie   = "savolbor_host"
	cookieMaxAge = 30 * 24 * 60 * 60
)

type deviceKey struct{}

// withDevice makes sure every request carries a device id, issuing a cookie
// on the first visit.
func withDevice(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := ""
		if c, err := r.Cookie(deviceCookie); err == nil && validDeviceID(c.Value) {
			id = c.Value
		} else {
			id = randomHex(16)
			setCookie(w, deviceCookie, id)
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), deviceKey{}, id)))
	})
}

// DeviceID returns the device id the middleware attached to the request.
func DeviceID(r *http.Request) string {
	id, _ := r.Context().Value(deviceKey{}).(string)
	return id
}

// IsHost reports whether the request comes from the presenter: the laptop
// itself, or any device holding the admin key.
func IsHost(r *http.Request, adminKey string) bool {
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		if ip := net.ParseIP(host); ip != nil && ip.IsLoopback() {
			return true
		}
	}
	key := r.URL.Query().Get("key")
	if key == "" {
		if c, err := r.Cookie(hostCookie); err == nil {
			key = c.Value
		}
	}
	return adminKey != "" && subtle.ConstantTimeCompare([]byte(key), []byte(adminKey)) == 1
}

func setCookie(w http.ResponseWriter, name, value string) {
	http.SetCookie(w, &http.Cookie{
		Name: name, Value: value, Path: "/", MaxAge: cookieMaxAge,
		HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
}

func validDeviceID(s string) bool {
	if len(s) != 32 {
		return false
	}
	_, err := hex.DecodeString(s)
	return err == nil
}

func randomHex(n int) string {
	buf := make([]byte, n)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}

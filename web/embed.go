// Package web holds the built participant and presenter pages (ui/ → dist).
package web

import "embed"

//go:embed all:dist
var Dist embed.FS

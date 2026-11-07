package qna

import "errors"

var (
	ErrEmpty    = errors.New("empty")
	ErrTooLong  = errors.New("too long")
	ErrNotFound = errors.New("not found")
	ErrNotOwner = errors.New("not owner")
	ErrAnswered = errors.New("already answered")
)

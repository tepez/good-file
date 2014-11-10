# good-file

File logging module for [good](https://github.com/hapijs/good) process monitoring.

![Build Status](https://travis-ci.org/hapijs/good-file.svg?branch=master) ![Current Version](https://img.shields.io/npm/v/good-file.svg)

Lead Maintainer: [Adam Bretz](https://github.com/arb)

## Usage

`good-file` is a [good-reporter](https://github.com/hapijs/good-reporter) implementation to write hapi server events to log files.

## Good File
### new GoodFile (path, events, [options])

creates a new GoodFile object with the following arguments
- `events` - an object of key value pairs.
	- `key` - one of the supported [good events](https://github.com/hapijs/good) indicating the hapi event to subscribe to
	- `value` - a single string or an array of strings to filter incoming events. "\*" indicates no filtering. `null` and `undefined` are assumed to be "\*"
- `options` - arguments object, either `file` or `directory` is required.
	- `[file]` - a string that indicates the log file to use. Opened in "append" mode.
	- `[directory]` - a string to a directory where you want a log file created. Name is randomly generated to match "good-file-{timestamp}-{randomstring}.log"


### GoodFile Methods
`good-file` implements the [good-reporter](https://github.com/hapijs/good-reporter) interface as has no additional public methods.

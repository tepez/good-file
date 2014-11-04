# good-file

File logging module for [good](https://github.com/hapijs/good) process monitoring.

![Build Status](https://travis-ci.org/hapijs/good-file.svg?branch=master) ![Current Version](https://img.shields.io/npm/v/good-file.svg)

Lead Maintainer: [Adam Bretz](https://github.com/arb)

## Usage

`good-file` is a [good-reporter](https://github.com/hapijs/good-reporter) implementation to write hapi server events to log files.

## Good File
### new GoodFile (path, events, [options])

creates a new GoodFile object with the following arguments
- `path` - (required) location to write log files. "./path/" creates "{timestamp}.extension" files in "./path/". "./path/log_name" creates "log_name.sequence" in "./path/". If you provide a "log_name", then the log files will be sequenced with a 3 digit file extension that will be padded with 0s. If your log files are created based on a timestamp, they will use `extension` as their file extension. If "./path/log_name" has any existing log files with the same name when this module is `start()`ed, the next number in sequence will be used.
- `events` - an object of key value pairs.
	- `key` - one of the supported [good events](https://github.com/hapijs/good) indicating the hapi event to subscribe to
	- `value` - a single string or an array of strings to filter incoming events. "\*" indicates no filtering. `null` and `undefined` are assumed to be "\*"
- `[options]` - optional arguments object
	- `[maxFileSize]` - how large a single log file can grow before a new one is created. Defaults to `Infinity`.
	- `[extension]` - extension to use for time-based file naming. Defaults to "good".
	- `[rotationTime]` - number of days to wait before advancing to the next log. Defaults to `0` which means use a different log rotation mechanism. This trumps all other file rotation mechanisms mechanisms. Implies `maxFileSize` of `Infinity` and always uses a `{timestamp}.extension` format.
	- `[format]` - a [momentjs](http://momentjs.com/docs/#/displaying/format/) format string. This setting is used to control the log filename when using time-based file creation. Defaults to `null` which will use `Date.now()` as a string.


### GoodFile Methods
`good-file` implements the [good-reporter](https://github.com/hapijs/good-reporter) interface as has no additional public methods.

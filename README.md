# good-file

File logging module for [good](https://github.com/hapijs/good) process monitoring.

![Build Status](https://travis-ci.org/hapijs/good-file.svg?branch=master) ![Current Version](https://img.shields.io/npm/v/good-file.svg)

Lead Maintainer: [Adam Bretz](https://github.com/arb)

## Usage

`good-file` is a [good-reporter](https://github.com/hapijs/good-reporter) implementation to write hapi server events to log files.

## Good File
### new GoodFile (configuration, events)

creates a new GoodFile object with the following arguments
- `configuration` - specifications for the file that will be used. All file operations are done in "append" mode.
	- `String` - a string that indicates the log file to use. Opened in "append" mode.
	- `Object` - a configuration object for automatically generated files. Auto generated files use the following pattern for file naming: "{`options.prefix`}-{utcTime.format(`options.format`)}-{random string}.{`settings.extension`}"
	 	- `path` - required. Path to store log files.
	 	- `[format]` - a [MomentJs](http://momentjs.com/docs/#/displaying/format/) format string. Defaults to "YYYY-MM-DD".
	 	- `[extension]` - file extension to use when creating a file. Defaults to ".log".
	 	- `[prefix]` - file name prefix to use when creating a file. Defaults to "good-file"
- `events` - an object of key value pairs.
	- `key` - one of the supported [good events](https://github.com/hapijs/good) indicating the hapi event to subscribe to
	- `value` - a single string or an array of strings to filter incoming events. "\*" indicates no filtering. `null` and `undefined` are assumed to be "\*"


### GoodFile Methods
`good-file` implements the [good-reporter](https://github.com/hapijs/good-reporter) interface as has no additional public methods.

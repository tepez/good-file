test:
	@node node_modules/lab/bin/lab -v
test-cov:
	@node node_modules/lab/bin/lab -v -t 100 -m 6000
test-cov-html:
	@node node_modules/lab/bin/lab -r html -o coverage.html -m 6000

.PHONY: test test-cov test-cov-html
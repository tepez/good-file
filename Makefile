test:
	@node node_modules/lab/bin/lab -v -L
test-cov:
	@node node_modules/lab/bin/lab -v -t 100 -m 3000 -L
test-cov-html:
	@node node_modules/lab/bin/lab -r html -o coverage.html -m 3000 -L

.PHONY: test test-cov test-cov-html
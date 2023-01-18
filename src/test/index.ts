/* global mocha */

import './tests/replay-tests';

declare global {
    interface Window {
        testsPromiseInfo: {
            resolve(failures: number): void;
        };
    }
}

const settings = Object.fromEntries(new URLSearchParams(window.location.search).entries());
if (settings.reporter) {
    mocha.reporter(settings.reporter);
}
mocha.run(failures => {
    window.testsPromiseInfo.resolve(failures);
});

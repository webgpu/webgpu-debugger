/* global mocha */
/* global URLSearchParams */
/* global window */

import './tests/webgpu-utils-tests.js';

const settings = Object.fromEntries(new URLSearchParams(window.location.search).entries());
if (settings.reporter) {
    mocha.reporter(settings.reporter);
}
mocha.run(failures => {
    window.testsPromiseInfo.resolve(failures);
});

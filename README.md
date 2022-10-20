# Spector2

WebGPU Debugger

## Development

* Install [node](https://nodejs.org). Note: I recommend using [nvm](https://github.com/nvm-sh/nvm)(mac/linux) or [nvm-windows](https://github.com/coreybutler/nvm-windows)(windows).
* run these commands:

  ```bash
  git clone https://github.com/Kangz/spector2.git
  cd spector2
  npm init
  ```

### Live development

```
npm run start
```

It should open a browser to `http://localhost:3003`. Edits to the code *should* end up showing up live in the browser.

## Building

```
npm run build
```

This builds the library as an es6 module into `dist/index.js`.

To use you'd do something like

```html
<div id="spector2"></div>
<script type="module">
import spector2 from '../dist/index.js';
spector2(document.querySelector('#spector2'));
</script>
```

See `example/index.html`

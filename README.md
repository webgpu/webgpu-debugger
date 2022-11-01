# Spector2

WebGPU Debugger

## Development

* Install [node](https://nodejs.org). Note: I recommend using [nvm](https://github.com/nvm-sh/nvm)(mac/linux) or [nvm-windows](https://github.com/coreybutler/nvm-windows)(windows).
* run these commands:

  ```bash
  git clone https://github.com/Kangz/spector2.git
  cd spector2
  npm ci
  ```

### Live development

```
npm start
```

It should open a browser to `http://localhost:3000/example/`. Edits to the code *should* end up showing up live in the browser.

## Building

```
npm run build
```

This builds 3 libraries.

1. the `capture` library `dist/capture.js`

   usage:
   
   ```js
   import { spector2 } from 'dist/capture.js
   
   ...
     const trace = await spector2.traceFrame();
   ```

2. the `replay` library `dist/replay.js`

   stand alone usage:
   
   ```js
   TBD
   ```

   usage with capture
   
   ```js
   TBD
   ```
   
3. the 'debugger' in `dist/spector2.js`

   usage:
   
   ```js
   import `dist/spector2.js`;
   ```
   
   or
   
   ```html
   <script src="dist/spector2.js"></script>
   ```

## Pushing changes

Before you push a change please run `npm run check` or, better yet, make it
automatic by putting 

```
npm run check
```

In `.git/hooks/pre-push` and then set the executable bit `chmod u+x .git/hooks/pre-push`

We use `prettier` to format code so if you find errors, some of them may be able to be
fixed with `npm run fix`.

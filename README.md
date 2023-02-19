# webgpu-debugger

# Note: This is still **ALPHA** code. See issues and other random TODO comments for things that need work

## Development

* Install [node](https://nodejs.org). Note: I recommend using [nvm](https://github.com/nvm-sh/nvm)(mac/linux) or [nvm-windows](https://github.com/coreybutler/nvm-windows)(windows).
* run these commands:

  ```bash
  git clone https://github.com/webgpu/webgpu-debugger.git
  cd webgpu-debugger
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
   import { webgpuDebugger } from 'dist/capture.js
   
   ...
     const trace = await webgpuDebugger.traceFrame();
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
   
3. the 'debugger' in `dist/webgpu-debugger.js`

   usage:
   
   ```js
   import `dist/webgpu-debugger.js`;
   ```
   
   or
   
   ```html
   <script src="dist/webgpu-debugger.js"></script>
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

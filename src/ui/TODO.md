# UI Todo

- [ ] If they don't already, every resources should get a number (1, 2, 3), otherwise, if the user
      does not label them they all show up the same

- [ ] Buffer view

  - [ ] show as grid of values with options for N values per row, as u8, i8, u16, float, etc....
  - [ ] handle all buffers. Not all buffers can be mapped so need to copy those buffers. 
        Also, not all buffers can be copied (or can they?), if not then need compute shader to copy?
  - [ ] figure out how we can eventually show uniforms, vertices, etc. 
        Compiling the shaders, looking up what they are bound to etc...
  - [ ] Can we have a 3D view (to show wireframes of 3D data?) 

- [ ] Texture view
  - [ ] Show textures, let you pick mips or show all mips?
  - [ ] Allow zooming
  - [ ] allow inspecting colors under the cursor (show actual values)
  - [ ] Magnifying glass
  - [ ] handle all texture formats
    - [ ] Formats that can't be put directly in a texture need to get rendered to a texture that can, 
          or rendered directly into the canvas for the UI view.
    - [ ] Need to handle int textures
  - [ ] Add range/level type settings so you can view data that's not easily visualized
  - [ ] Consider adding the ability add user created shader snippets to convert to something visualizable

- [ ] Switch to holding both capture and replay?
  - [ ] Put capture in blob? (premature optimization?)

        once a capture is turned into a replay the capture is not needed
        except to offer the user to save.

  - [ ] Discard Replay if not in use and regenerate (premature optimization?)

        If you have many replays they probably represent lots of data.
        If you switch replays maybe the non-current ones should be discarded
        and then they can be regenerated from the capture (which is stored in
        a blob, can take no/less memory)

- [ ] Load capture
  - [ ] Load JSON
  - [ ] Load Zip
  - [ ] Load multiple JSON
  - [ ] Load multiple from zip 
  - [ ] Drag and Drop

- [ ] Save Capture

- [ ] Add a most recently active view for each type of view

      For example, when you click a buffer in the Steps view
      it should show the buffer in the most recent buffer view

- [ ] Settings
  - [ ] Make it so you can pop out into separate window

  - [ ] Choose whether it's an overlay or a sidebar?

        The difference. An overlay sits on top of the
        content. A sidebar makes the content area smaller.

        ```
          No UI         Overlay       Sidebar
        +---------+   +----+----+   +----+----+
        |content  |   |cont| UI |   |cont| UI |
        |         |   |    |    |   |en  |    |
        +---------+   +----+----+   +----+----+
        ```

  - [ ] Choose sides (left, right, top, bottom)

  - [ ] Add option to wrap steps.
  
        Some lines will be long
        so it'd be nice not to have to scroll to see them?
        But some users might want 1 step per line

- [ ] Let user drag/size UI (right now hard coded to 50%)

- [ ] Let use drag and drop a value representing an object to create a new pane

- [ ] Add Icons for buttons

- [ ] Add Icons for steps

- [ ] Show Frames, Let you select a frame, updates most recently

- [ ] Make pane bars have split icon

- [ ] Make pane bars have drop down for view type

- [ ] Make it save layout to local storage


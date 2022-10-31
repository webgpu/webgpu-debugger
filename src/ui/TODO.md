# UI Todo

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


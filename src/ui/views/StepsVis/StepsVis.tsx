import React from "react";
import {
  Command,
  CommandArgs,
  QueueSubmitArgs,
  Replay,
} from "../../../replay/lib";

import "./StepsVis.css";

function Arg({k, v}: {k: string, v: any}) {
  return (
    <div>{v === undefined ? 'undefined' : v.toString()}: {k}</div>
  );
}


function Args({args}: {args: CommandArgs}) {
  return (
    <div className="spector2-cmd-args">
      {Object.entries(args).map(([k, v], ndx) => <Arg key={`a${ndx}`} k={k} v={v} />)}
    </div>
  )
}

function QueueSubmit({command}: {command: Command}) {
  const {name, args} = command;
  const qsArgs: QueueSubmitArgs = args as QueueSubmitArgs;
  const commandBuffers = qsArgs.commandBuffers;
  return (
    <React.Fragment>
      <div className="spector2-cmd" key="foo1">
        <div className="spector2-cmd-name">{name}</div>
      </div>
        {
          commandBuffers.map((cb, ndx) => {
            return (
            <React.Fragment key={`cm${ndx}`}>
              <div key={`cb${ndx}`}>CommandBuffer: #{ndx}</div>
              {
                cb.commands.map((c, cNdx) => {
                  const id = `cb${ndx}_${cNdx}`;
                  return <Command key={id} id={id} command={c} />;
                })
              }
            </React.Fragment> 
            );
          })
        }
    </React.Fragment>
  )
}

function GenericCommand({command}: {command: Command}) {
  const {name, args} = command;
  return (
    <div className="spector2-cmd">
      <div className="spector2-cmd-name">{name}</div>
      {
        args ? <Args args={args} /> : ''
      }
    </div>
  );
}

function Command({command, id}: {command: Command, id: string}) {
  const {name} = command;
  // MEH! I feel like this should/could be generic.
  switch(name) {
    case 'queueSubmit':
      return <QueueSubmit key={`qs${id}`} command={command} />
    default:
      return <GenericCommand key={`gc${id}`} command={command}/>
  }
}

export default function StepsVis({data}: {data: Replay}) {
  return (
    <div className="spector2-viz">
      {data
         ? data.commands.map((c, ndx) => <Command key={`f${ndx}`} id={ndx.toString()} command={c} />)
         : ("no replay")
      }
    </div>);
}
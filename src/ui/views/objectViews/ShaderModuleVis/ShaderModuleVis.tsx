import React, { useState } from 'react';
import { ReplayShaderModule } from '../../../../replay';
import Checkbox from '../../../components/Checkbox/Checkbox';
import { ValueObject } from '../../../components/Value/Value';

// This is kind of a hack in that it's not taking the tab size into account.
// At stop point, instead of a `<pre>` tag we'll use a `<textarea>` to allow you
// to edit or else a fancier editor like CodeMirror or monaco.
function optionallyRemoveLeadingWhitespace(removeLeadingWhitespace: boolean, s: string) {
    if (removeLeadingWhitespace) {
        const allMatches = [...s.matchAll(/^[ \t]+/gm)];
        if (allMatches) {
            const trimLength = allMatches.reduce(
                (shortest, m) => Math.min(shortest, m[0].length),
                Number.MAX_SAFE_INTEGER
            );
            const lines = s.split('\n');
            lines.forEach((line, ndx) => {
                if (line.length >= trimLength) {
                    lines[ndx] = line.substring(trimLength);
                }
            });
            s = lines.join('\n');
        }
    }
    return s;
}

export default function ShaderModuleVis({ data }: { data: ReplayShaderModule }) {
    const { desc } = data;
    const [raw, setRaw] = useState(false);

    return (
        <div className="spector2-vis">
            <ValueObject data={desc.hints || {}} />
            <Checkbox label="raw" checked={raw} onChange={setRaw} />
            <pre>{optionallyRemoveLeadingWhitespace(!raw, desc.code)}</pre>
        </div>
    );
}

import React, { CSSProperties } from 'react';
import { TextureSamples } from './TextureInspector';

import './TextureSamplesVis.css';

interface Props {
    data: TextureSamples;
    style: CSSProperties;
}

export default function TextureSamplesVis({ data, style = {} }: Props) {
    return (
        <div className="spector2-texture-samples-vis" style={style}>
            <table>
                <tbody>
                    <tr>
                        <td colSpan={2}>
                            Pixel (x: {data.position.x}, y: {data.position.y})
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2}>Samples:</td>
                    </tr>
                    {data.samples.map((sample, ndx) => (
                        <tr key={`e${ndx}`}>
                            <td
                                className="spector2-texture-samples-color"
                                style={{ backgroundColor: sample.cssColor }}
                            ></td>
                            <td>[{sample.values.join(', ')}]</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

import React, { CSSProperties } from 'react';
import { TextureSampleResult } from './TextureColorPicker';

import './ColorPickerResult.css';

interface Props {
    position: { x: number; y: number };
    samples: Array<TextureSampleResult>;
    style: CSSProperties;
}

const ColorPickerResult: React.FC<Props> = ({ position, samples, style = {} }: Props) => {
    return (
        <div className="spector2-colorpickerresult" style={style}>
            <table>
                <tbody>
                    <tr>
                        <td>Coord:</td>
                        <td>
                            [{position.x}, {position.y}]
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2}>Samples:</td>
                    </tr>
                    {samples.map((sample, ndx) => (
                        <tr key={`e${ndx}`}>
                            <td
                                style={{
                                    width: '1em',
                                    backgroundColor: sample.cssColor,
                                }}
                            ></td>
                            <td>[{sample.values.join(', ')}]</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ColorPickerResult;

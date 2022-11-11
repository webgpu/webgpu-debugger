import React, { useState, useEffect } from 'react';
import { RenderPipelinePreviewLayout, PreviewVertexAttribute } from '../../../replay';
import SelectSimpleIndex from '../../components/SelectSimple/SelectSimpleIndex';

interface Props {
    data: RenderPipelinePreviewLayout;
}

function attribOptions(previewAttribs : Array<PreviewVertexAttribute>) {
    return previewAttribs.map(
        (attrib: PreviewVertexAttribute) => `@location(${attrib.shaderLocation}): ${attrib.format}, buffer[${attrib.buffer}]+${attrib.offset}`
    );
}

export function RenderPipelinePreviewLayoutVis({ data }: Props) {
    const [position, setPosition] = useState(data.positionAttrib);
    const [texCoord, setTexCoord] = useState(data.texCoordAttrib);
    const [normal, setNormal] = useState(data.normalAttrib);
    const [color, setColor] = useState(data.colorAttrib);

    useEffect(() => { data.positionAttrib = position; }, [position]);
    useEffect(() => { data.texCoordAttrib = texCoord; }, [texCoord]);
    useEffect(() => { data.normalAttrib = normal; }, [normal]);
    useEffect(() => { data.colorAttrib = color; }, [color]);

    return (
        <div className="spector2-render-pipeline-preview-layout-vis">
            <table>
                <tbody>
                    <tr>
                        <td>Position:</td>
                        <td>
                            <SelectSimpleIndex
                                value={position}
                                noneOption={'- None -'}
                                options={attribOptions(data.previewAttribs)}
                                onChange={setPosition}
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>TexCoord:</td>
                        <td>
                            <SelectSimpleIndex
                                value={texCoord}
                                noneOption={'- None -'}
                                options={attribOptions(data.previewAttribs)}
                                onChange={setTexCoord}
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Normal:</td>
                        <td>
                            <SelectSimpleIndex
                                value={normal}
                                noneOption={'- None -'}
                                options={attribOptions(data.previewAttribs)}
                                onChange={setNormal}
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Color:</td>
                        <td>
                            <SelectSimpleIndex
                                value={color}
                                noneOption={'- None -'}
                                options={attribOptions(data.previewAttribs)}
                                onChange={setColor}
                            />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

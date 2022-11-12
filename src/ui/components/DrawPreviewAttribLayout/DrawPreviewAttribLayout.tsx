import React, { useState, useEffect } from 'react';
import { ReplayRenderPipeline } from '../../../replay';
import { DrawPreviewPipeline, DrawPreviewVertexAttribute } from '../../components/DrawPreviewViewer/DrawPreviewRenderer';
import SelectSimpleIndex from '../../components/SelectSimple/SelectSimpleIndex';

function attribOptions(previewAttribs : Array<DrawPreviewVertexAttribute>) {
    return previewAttribs.map(
        (attrib: DrawPreviewVertexAttribute) => `@location(${attrib.shaderLocation}): ${attrib.format}, buffer[${attrib.buffer}]+${attrib.offset}`
    );
}

interface Props {
    data: ReplayRenderPipeline;
}

export function DrawPreviewAttribLayout({ data }: Props) {
    const drawPreview = DrawPreviewPipeline.getDrawPreviewPipeline(data);

    const [position, setPosition] = useState(drawPreview.positionAttrib);
    const [texCoord, setTexCoord] = useState(drawPreview.texCoordAttrib);
    const [normal, setNormal] = useState(drawPreview.normalAttrib);
    const [color, setColor] = useState(drawPreview.colorAttrib);

    useEffect(() => { drawPreview.positionAttrib = position; }, [position]);
    useEffect(() => { drawPreview.texCoordAttrib = texCoord; }, [texCoord]);
    useEffect(() => { drawPreview.normalAttrib = normal; }, [normal]);
    useEffect(() => { drawPreview.colorAttrib = color; }, [color]);

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
                                options={attribOptions(drawPreview.previewAttribs)}
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
                                options={attribOptions(drawPreview.previewAttribs)}
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
                                options={attribOptions(drawPreview.previewAttribs)}
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
                                options={attribOptions(drawPreview.previewAttribs)}
                                onChange={setColor}
                            />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

import React, { useState } from 'react';
import { ReplayTextureView } from '../../../../replay';
import Checkbox from '../../../components/Checkbox/Checkbox';
import Range from '../../../components/Range/Range';
import TextureLevelViewer from '../../../components/TextureLevelViewer/TextureLevelViewer';
import { ValueObject } from '../../../components/Value/Value';

export default function TextureViewVis({ data }: { data: ReplayTextureView }) {
    const [actualSize, setActualSize] = useState(false);
    const [mipLevel, setMipLevel] = useState(data.baseMipLevel);
    const [arrayLayer, setArrayLayer] = useState(data.baseArrayLayer);
    const [pixelated, setPixelated] = useState(false);

    const maxMipLevel = data.baseMipLevel + data.mipLevelCount - 1;
    const maxArrayLayer = data.baseArrayLayer + data.arrayLayerCount - 1;

    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
            <div>
                <Checkbox label="Display actual size:" checked={actualSize} onChange={setActualSize} />
                <Checkbox label="Pixelated:" checked={pixelated} onChange={setPixelated} />
            </div>
            {data.arrayLayerCount > 1 && (
                <div>
                    <Range
                        label="Layer:"
                        min={data.baseArrayLayer}
                        max={maxArrayLayer}
                        value={arrayLayer}
                        valueFormatFn={(v: number) => `${v} of [${data.baseArrayLayer}, ${maxArrayLayer}]`}
                        onChange={setArrayLayer}
                    />
                </div>
            )}
            {data.mipLevelCount > 1 && (
                <div>
                    <Range
                        label="Level:"
                        min={data.baseMipLevel}
                        max={maxMipLevel}
                        value={mipLevel}
                        valueFormatFn={(v: number) => `${v} of [${data.baseMipLevel}, ${maxMipLevel}]`}
                        onChange={setMipLevel}
                    />
                </div>
            )}
            <div style={{ imageRendering: pixelated ? 'pixelated' : 'auto' }}>
                <TextureLevelViewer
                    texture={data.texture}
                    mipLevel={mipLevel}
                    layer={arrayLayer}
                    actualSize={actualSize}
                />
            </div>
        </div>
    );
}

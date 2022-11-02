import React, { useState } from 'react';
import { ReplayTexture } from '../../../../replay';
import Checkbox from '../../../components/Checkbox/Checkbox';
import Range from '../../../components/Range/Range';
import TextureLevelViewer from '../../../components/TextureLevelViewer/TextureLevelViewer';
import { ValueObject } from '../../../components/Value/Value';

export default function TextureVis({ data }: { data: ReplayTexture }) {
    const [actualSize, setActualSize] = useState(false);
    const [mipLevel, setMipLevel] = useState(0);
    const [arrayLayer, setArrayLayer] = useState(0);
    const [pixelated, setPixelated] = useState(false);

    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
            <div>
                <Checkbox label="Display actual size:" checked={actualSize} onChange={setActualSize} />
                <Checkbox label="Pixelated:" checked={pixelated} onChange={setPixelated} />
            </div>
            {data.size.depthOrArrayLayers > 1 && (
                <div>
                    <Range
                        label="Layer:"
                        max={data.size.depthOrArrayLayers - 1}
                        value={arrayLayer}
                        valueFormatFn={(v: number) => `${v} of [0, ${data.size.depthOrArrayLayers - 1}]`}
                        onChange={setArrayLayer}
                    />
                </div>
            )}
            {data.mipLevelCount > 1 && (
                <div>
                    <Range
                        label="Mip Level:"
                        max={data.mipLevelCount - 1}
                        value={mipLevel}
                        valueFormatFn={(v: number) => `${v} of [0, ${data.mipLevelCount - 1}]`}
                        onChange={setMipLevel}
                    />
                </div>
            )}
            <div style={{ imageRendering: pixelated ? 'pixelated' : 'auto' }}>
                <TextureLevelViewer texture={data} mipLevel={mipLevel} layer={arrayLayer} actualSize={actualSize} />
            </div>
        </div>
    );
}

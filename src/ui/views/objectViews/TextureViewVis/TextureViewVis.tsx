import React, { useState } from 'react';
import { ReplayTextureView } from '../../../../replay';
import TextureLevelViewer from '../../../components/TextureLevelViewer/TextureLevelViewer';
import { ValueObject } from '../../../components/Value/Value';

export default function TextureViewVis({ data }: { data: ReplayTextureView }) {
    const [actualSize, setActualSize] = useState(false);
    const [mipLevel, setMipLevel] = useState(data.baseMipLevel);
    const [arrayLayer, setArrayLayer] = useState(data.baseArrayLayer);

    const maxMipLevel = data.baseMipLevel + data.mipLevelCount - 1;
    const maxArrayLayer = data.baseArrayLayer + data.arrayLayerCount - 1;

    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
            <div>
                <span>Display actual size: </span>
                <input type="checkbox" checked={actualSize} onChange={e => setActualSize(e.target.checked)} />
            </div>
            {data.arrayLayerCount > 1 && (
                <div>
                    <span>Layer: </span>
                    <input
                        type="range"
                        min={data.baseArrayLayer}
                        max={maxArrayLayer}
                        value={arrayLayer}
                        onChange={e => setArrayLayer(parseInt(e.target.value))}
                    />{' '}
                    {arrayLayer} of [{data.baseArrayLayer}, {maxArrayLayer}]
                </div>
            )}
            {data.mipLevelCount > 1 && (
                <div>
                    <span>Mip Level: </span>
                    <input
                        type="range"
                        min={data.baseMipLevel}
                        max={maxMipLevel}
                        value={mipLevel}
                        onChange={e => setMipLevel(parseInt(e.target.value))}
                    />{' '}
                    {mipLevel} of [{data.baseMipLevel}, {maxMipLevel}]
                </div>
            )}
            <TextureLevelViewer texture={data.texture} mipLevel={mipLevel} layer={arrayLayer} actualSize={actualSize} />
        </div>
    );
}

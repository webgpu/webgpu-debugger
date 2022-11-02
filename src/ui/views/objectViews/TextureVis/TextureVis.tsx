import React, { useState } from 'react';
import { ReplayTexture } from '../../../../replay';
import TextureLevelViewer from '../../../components/TextureLevelViewer/TextureLevelViewer';
import { ValueObject } from '../../../components/Value/Value';

export default function TextureVis({ data }: { data: ReplayTexture }) {
    const [actualSize, setActualSize] = useState(false);
    const [mipLevel, setMipLevel] = useState(0);
    const [arrayLayer, setArrayLayer] = useState(0);

    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
            <div>
                <span>Display actual size: </span>
                <input type="checkbox" checked={actualSize} onChange={e => setActualSize(e.target.checked)} />
            </div>
            {data.size.depthOrArrayLayers > 1 && (
                <div>
                    <span>Layer: </span>
                    <input
                        type="range"
                        min="0"
                        max={data.size.depthOrArrayLayers - 1}
                        value={arrayLayer}
                        onChange={e => setArrayLayer(parseInt(e.target.value))}
                    />{' '}
                    {arrayLayer} of [0, {data.size.depthOrArrayLayers - 1}]
                </div>
            )}
            {data.mipLevelCount > 1 && (
                <div>
                    <span>Mip Level: </span>
                    <input
                        type="range"
                        min="0"
                        max={data.mipLevelCount - 1}
                        value={mipLevel}
                        onChange={e => setMipLevel(parseInt(e.target.value))}
                    />{' '}
                    {mipLevel} of [0, {data.mipLevelCount - 1}]
                </div>
            )}
            <TextureLevelViewer texture={data} mipLevel={mipLevel} layer={arrayLayer} actualSize={actualSize} />
        </div>
    );
}

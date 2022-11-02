import React, { useState } from 'react';
import { ReplayTexture } from '../../../../replay';
import TextureLevelViewer from '../../../components/TextureLevelViewer/TextureLevelViewer';
import { ValueObject } from '../../../components/Value/Value';

export default function TextureVis({ data }: { data: ReplayTexture }) {
    const [actualSize, setActualSize] = useState(false);
    const [mipLevel, setMipLevel] = useState(0);

    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
            <div>
                <span>Display actual size: </span>
                <input type="checkbox" checked={actualSize} onChange={e => setActualSize(e.target.checked)} />
            </div>
            <div>
                <span>Show mipLevel: </span>
                <input
                    type="range"
                    min="0"
                    max={data.mipLevelCount - 1}
                    value={mipLevel}
                    onChange={e => setMipLevel(parseInt(e.target.value))}
                />{' '}
                {mipLevel} of [0, {data.mipLevelCount - 1}]
            </div>
            <TextureLevelViewer texture={data} mipLevel={mipLevel} actualSize={actualSize} />
        </div>
    );
}

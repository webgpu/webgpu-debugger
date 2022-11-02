import React, { useState } from 'react';
import { ReplayTextureView } from '../../../../replay';
import TextureLevelViewer from '../../../components/TextureLevelViewer/TextureLevelViewer';
import { ValueObject } from '../../../components/Value/Value';

export default function TextureViewVis({ data }: { data: ReplayTextureView }) {
    const [actualSize, setActualSize] = useState(false);
    const [mipLevel, setMipLevel] = useState(data.baseMipLevel);

    const maxMipLevel = data.baseMipLevel + data.mipLevelCount - 1;

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
                    min={data.baseMipLevel}
                    max={maxMipLevel}
                    value={mipLevel}
                    onChange={e => setMipLevel(parseInt(e.target.value))}
                />{' '}
                {mipLevel} of [{data.baseMipLevel}, {maxMipLevel}]
            </div>
            <TextureLevelViewer texture={data.texture} mipLevel={mipLevel} actualSize={actualSize} />
        </div>
    );
}

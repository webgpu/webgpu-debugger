import React from 'react';
import { ReplayTextureView } from '../../../../replay';
import TextureLevelViewer from '../../../components/TextureLevelViewer/TextureLevelViewer';
import { ValueObject } from '../../../components/Value/Value';

export default function TextureViewVis({ data }: { data: ReplayTextureView }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
            <TextureLevelViewer
                texture={data.texture}
                baseMipLevel={data.baseMipLevel}
                mipLevelCount={data.mipLevelCount}
                baseArrayLayer={data.baseArrayLayer}
                arrayLayerCount={data.arrayLayerCount}
            />
        </div>
    );
}

import React from 'react';
import { ReplayTextureView } from '../../../../replay';
import TextureLevelViewer from '../../../components/TextureLevelViewer/TextureLevelViewer';
import { JsonValueObject } from '../../../components/JsonValue/JsonValue';

export default function TextureViewVis({ data }: { data: ReplayTextureView }) {
    return (
        <div className="spector2-vis">
            <JsonValueObject data={data} />
            <div className="spector2-top-separator"></div>
            <TextureLevelViewer
                texture={data.texture}
                baseMipLevel={data.baseMipLevel}
                mipLevelCount={data.mipLevelCount}
                baseArrayLayer={data.baseArrayLayer}
                arrayLayerCount={data.arrayLayerCount}
                displayType={data.dimension === 'cube' || data.dimension === 'cube-array' ? 'cube' : '2d'}
            />
        </div>
    );
}

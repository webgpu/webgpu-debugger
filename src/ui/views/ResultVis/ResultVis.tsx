import React from 'react';
import { ReplayTexture } from '../../../replay';
import TextureLevelViewer from '../../components/TextureLevelViewer/TextureLevelViewer';

import './ResultVis.css';

// TODO: this should take a textureview?
type ResultsVisProps = {
    data: {
        texture: ReplayTexture;
        mipLevel: 0;
    };
};

const ResultVis = ({ data }: ResultsVisProps) => {
    const { texture, mipLevel } = data || {};

    return (
        <div className="wgdb-vis">
            {texture ? (
                <TextureLevelViewer texture={texture} baseMipLevel={mipLevel} mipLevelCount={1} />
            ) : (
                <div>-- no result --</div>
            )}
        </div>
    );
};

export default ResultVis;

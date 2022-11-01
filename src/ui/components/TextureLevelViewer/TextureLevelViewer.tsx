import React from 'react';

interface Props {
    texture: GPUTexture;
    mipLevel: number;
}

export const TextureLevelViewer: React.FC<Props> = ({ texture, mipLevel }) => {
    return <div>Texture mipLevel: {mipLevel} Goes here</div>;
};

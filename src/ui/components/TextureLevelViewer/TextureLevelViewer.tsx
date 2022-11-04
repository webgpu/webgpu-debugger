import React, { useState, useRef, useEffect, useContext, CSSProperties } from 'react';
import { ReplayTexture } from '../../../replay';
import { getUnwrappedGPUCanvasContext } from '../../../capture';
import { UIStateContext } from '../../contexts/UIStateContext';
import Checkbox from '../../components/Checkbox/Checkbox';
import SelectSimple from '../../components/SelectSimple/SelectSimple';
import Range from '../../components/Range/Range';
import { TextureRenderer, CubeTextureRenderer } from './TextureRenderer';
import { TextureColorPicker } from './TextureColorPicker';
import ColorPickerResult from './ColorPickerResult';

import './TextureLevelViewer.css';

const s_displayTypes = ['2d', 'cube'];
const DEG_TO_RAD = Math.PI / 180;

interface Props {
    texture: ReplayTexture;
    baseMipLevel?: number;
    mipLevelCount?: number;
    baseArrayLayer?: number;
    arrayLayerCount?: number;
    displayType?: string;
}

const TextureLevelViewer: React.FC<Props> = ({
    texture,
    baseMipLevel = 0,
    mipLevelCount,
    baseArrayLayer = 0,
    arrayLayerCount,
    displayType = '2d',
}: Props) => {
    const [actualSize, setActualSize] = useState(false);
    const [pixelated, setPixelated] = useState(false);
    const [mipLevel, setMipLevel] = useState(baseMipLevel);
    const [arrayLayer, setArrayLayer] = useState(baseArrayLayer);
    const [display, setDisplay] = useState(displayType);
    const [colorPosition, setColorPosition] = useState({ x: 0, y: 0 });
    const [colorValues, setColorValues] = useState(new Float32Array(4));
    const [colorResultStyle, setColorResultStyle] = useState({ display: 'none' } as CSSProperties);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { helper } = useContext(UIStateContext);

    if (mipLevelCount === undefined) {
        mipLevelCount = texture.mipLevelCount - baseMipLevel;
    }
    if (arrayLayerCount === undefined) {
        arrayLayerCount = texture.size.depthOrArrayLayers - baseArrayLayer;
    }

    const maxMipLevel = baseMipLevel + mipLevelCount - 1;
    const maxArrayLayer = baseArrayLayer + arrayLayerCount - 1;

    useEffect(() => {
        const device = texture.device.webgpuObject!;

        const canvas = canvasRef.current!;
        canvas.width = texture.size.width >> mipLevel;
        canvas.height = texture.size.height >> mipLevel;

        const context = getUnwrappedGPUCanvasContext(canvas);
        context.configure({
            device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: 'premultiplied',
        });

        let angleX = 0;
        let angleY = 0;
        let dragging = false;
        const pointerDown = () => {
            if (display === 'cube') {
                dragging = true;
            }
        };
        const pointerUp = () => {
            dragging = false;
        };
        const pointerEnter = () => {};
        const pointerLeave = () => {
            setColorResultStyle({ display: 'none' });
        };
        const pointerMove = async (e: PointerEvent) => {
            if (dragging) {
                angleX += e.movementX * DEG_TO_RAD;
                angleY += e.movementY * DEG_TO_RAD;
            } else if (display === '2d') {
                const picker = TextureColorPicker.getColorPickerForDevice(device);
                const x = Math.floor(e.offsetX * (canvas.width / canvas.offsetWidth));
                const y = Math.floor(e.offsetY * (canvas.height / canvas.offsetHeight));
                const result = await picker.getColor(texture.webgpuObject, x, y, mipLevel, arrayLayer);
                setColorPosition({ x, y });
                setColorValues(result);
                setColorResultStyle({
                    display: 'block',
                    left: e.offsetX + canvas.offsetLeft + 5,
                    top: e.offsetY + canvas.offsetTop + 5,
                });
            }
        };

        canvas.addEventListener('pointerdown', pointerDown);
        canvas.addEventListener('pointerup', pointerUp);
        canvas.addEventListener('pointerenter', pointerEnter);
        canvas.addEventListener('pointerleave', pointerLeave);
        canvas.addEventListener('pointermove', pointerMove);

        let rafId = -1;
        const draw = () => {
            switch (display) {
                case '2d':
                    {
                        const renderer = TextureRenderer.getRendererForDevice(device);
                        renderer.render(context, texture.webgpuObject, mipLevel, arrayLayer);
                    }
                    break;
                case 'cube':
                    {
                        rafId = requestAnimationFrame(draw);
                        const renderer = CubeTextureRenderer.getRendererForDevice(device);
                        renderer.render(context, texture.webgpuObject, mipLevel, 0, angleX, angleY);
                    }
                    break;
            }
        };
        draw();

        return () => {
            setColorResultStyle({ display: 'none' });
            cancelAnimationFrame(rafId);

            canvas.removeEventListener('pointerdown', pointerDown);
            canvas.removeEventListener('pointerup', pointerUp);
            canvas.removeEventListener('pointerenter', pointerEnter);
            canvas.removeEventListener('pointerleave', pointerLeave);
            canvas.removeEventListener('pointermove', pointerMove);
        };
    }, [texture, mipLevel, arrayLayer, display, helper.state.replayCount]);

    return (
        <div className="spector2-textureviewer" style={{ imageRendering: pixelated ? 'pixelated' : 'auto' }}>
            <div>
                <Checkbox label="Display actual size:" checked={actualSize} onChange={setActualSize} />
                <Checkbox label="Pixelated:" checked={pixelated} onChange={setPixelated} />
                {arrayLayerCount >= 6 && (
                    <SelectSimple label="Display as:" value={display} options={s_displayTypes} onChange={setDisplay} />
                )}
            </div>
            {arrayLayerCount > 1 && display === '2d' && (
                <div>
                    <Range
                        label="Layer:"
                        min={baseArrayLayer}
                        max={maxArrayLayer}
                        value={arrayLayer}
                        valueFormatFn={(v: number) => `${v} of [${baseArrayLayer}, ${maxArrayLayer}]`}
                        onChange={setArrayLayer}
                    />
                </div>
            )}
            {mipLevelCount > 1 && (
                <div>
                    <Range
                        label="Mip Level:"
                        min={baseMipLevel}
                        max={maxMipLevel}
                        value={mipLevel}
                        valueFormatFn={(v: number) => `${v} of [${baseMipLevel}, ${maxMipLevel}]`}
                        onChange={setMipLevel}
                    />
                </div>
            )}
            <div className="spector2-textureviewer-canvascontainer">
                <ColorPickerResult position={colorPosition} values={colorValues} style={colorResultStyle} />
                <canvas ref={canvasRef} className={actualSize ? display : `fill ${display}`} />
            </div>
        </div>
    );
};

export default TextureLevelViewer;

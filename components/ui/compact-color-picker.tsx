'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hexToHsl, hslToHex, type HSL } from '@/lib/color-utils';
import { X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface CompactColorPickerProps {
  color: string; // Initial hex color
  onChange: (color: string) => void;
  onClose: () => void;
  position: { x: number; y: number }; // Position to display popup
}

export function CompactColorPicker({
  color,
  onChange,
  onClose,
  position,
}: CompactColorPickerProps) {
  const [hexValue, setHexValue] = useState(color);
  const [hsl, setHsl] = useState<HSL>(() => hexToHsl(color) || { h: 0, s: 0, l: 50 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);

  const PICKER_SIZE = 200;
  const HUE_HEIGHT = 20;

  // Close on click outside (with delay to prevent race conditions)
  useEffect(() => {
    let mounted = true;

    const handleClickOutside = (event: MouseEvent) => {
      if (!mounted) return;
      const target = event.target as HTMLElement;

      // Don't close if clicking on a ZenColorPicker dot (user switching dots)
      if (target.closest('[data-dot-id]')) return;

      if (pickerRef.current && !pickerRef.current.contains(target)) {
        onClose();
      }
    };

    // Small delay so the picker doesn't immediately close on the same click that opened it
    const timer = setTimeout(() => {
      if (mounted) {
        document.addEventListener('mousedown', handleClickOutside);
      }
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Draw saturation/lightness canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw saturation (left to right) and lightness (bottom to top)
    for (let y = 0; y < PICKER_SIZE; y++) {
      for (let x = 0; x < PICKER_SIZE; x++) {
        const saturation = (x / PICKER_SIZE) * 100;
        const lightness = ((PICKER_SIZE - y) / PICKER_SIZE) * 100;
        const hslColor = `hsl(${hsl.h}, ${saturation}%, ${lightness}%)`;
        ctx.fillStyle = hslColor;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [hsl.h]);

  // Draw hue bar
  useEffect(() => {
    const canvas = hueRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    for (let x = 0; x < PICKER_SIZE; x++) {
      const hue = (x / PICKER_SIZE) * 360;
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fillRect(x, 0, 1, HUE_HEIGHT);
    }
  }, []);

  // Handle dragging on canvas for smooth real-time updates
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingCanvas) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, PICKER_SIZE));
        const y = Math.max(0, Math.min(e.clientY - rect.top, PICKER_SIZE));

        const saturation = (x / PICKER_SIZE) * 100;
        const lightness = ((PICKER_SIZE - y) / PICKER_SIZE) * 100;

        const newHsl: HSL = {
          h: hsl.h,
          s: saturation,
          l: lightness,
        };

        setHsl(newHsl);
        const hex = hslToHex(newHsl);
        setHexValue(hex);
        onChange(hex);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingCanvas(false);
    };

    if (isDraggingCanvas) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingCanvas, hsl.h, onChange]);

  // Handle dragging on hue bar for smooth real-time updates
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingHue) {
        const canvas = hueRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, PICKER_SIZE));

        const hue = (x / PICKER_SIZE) * 360;

        const newHsl: HSL = {
          h: hue,
          s: hsl.s,
          l: hsl.l,
        };

        setHsl(newHsl);
        const hex = hslToHex(newHsl);
        setHexValue(hex);
        onChange(hex);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingHue(false);
    };

    if (isDraggingHue) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingHue, hsl.s, hsl.l, onChange]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDraggingCanvas(true);
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const saturation = (x / PICKER_SIZE) * 100;
    const lightness = ((PICKER_SIZE - y) / PICKER_SIZE) * 100;

    const newHsl: HSL = {
      h: hsl.h,
      s: saturation,
      l: lightness,
    };

    setHsl(newHsl);
    const hex = hslToHex(newHsl);
    setHexValue(hex);
    onChange(hex);
  };

  const handleHueMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDraggingHue(true);
    
    const canvas = hueRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const hue = (x / PICKER_SIZE) * 360;

    const newHsl: HSL = {
      h: hue,
      s: hsl.s,
      l: hsl.l,
    };

    setHsl(newHsl);
    const hex = hslToHex(newHsl);
    setHexValue(hex);
    onChange(hex);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Ensure it starts with #
    if (!value.startsWith('#')) {
      value = '#' + value;
    }

    setHexValue(value);

    // Validate hex format
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      const newHsl = hexToHsl(value);
      if (newHsl) {
        setHsl(newHsl);
        onChange(value);
      }
    }
  };

  // Calculate position (use absolute positioning within modal)
  const getPopupStyle = (): React.CSSProperties => {
    // Get modal container bounds
    const modalContent = document.querySelector('[role="dialog"]');
    const modalBounds = modalContent?.getBoundingClientRect();

    if (modalBounds) {
      // Position is already calculated by parent with smart bounds checking
      // Use absolute positioning within modal
      return {
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
      };
    } else {
      // Fallback to fixed positioning if not in modal
      const popupWidth = PICKER_SIZE + 48;
      const popupHeight = 340;
      
      let left = position.x;
      let top = position.y + 30;

      if (left + popupWidth > window.innerWidth - 16) {
        left = window.innerWidth - popupWidth - 16;
      }
      if (top + popupHeight > window.innerHeight - 16) {
        top = position.y - popupHeight - 10;
      }

      return {
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        zIndex: 9999,
      };
    }
  };

  // Calculate cursor position on saturation/lightness canvas
  const cursorX = (hsl.s / 100) * PICKER_SIZE;
  const cursorY = ((100 - hsl.l) / 100) * PICKER_SIZE;

  // Calculate cursor position on hue bar
  const hueCursorX = (hsl.h / 360) * PICKER_SIZE;

  return (
    <div
      ref={pickerRef}
      style={getPopupStyle()}
      className="bg-[#0a0d11]/95 backdrop-blur-xl border border-[#57FCFF]/20 rounded-lg p-6 shadow-2xl"
    >
      <div className="flex items-center justify-between mb-4">
        <Label className="text-sm font-medium text-foreground">Pick Color</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Saturation/Lightness Canvas */}
      <div className="relative mb-4">
        <canvas
          ref={canvasRef}
          width={PICKER_SIZE}
          height={PICKER_SIZE}
          className="rounded-lg cursor-crosshair border border-border/50"
          onMouseDown={handleCanvasMouseDown}
        />
        {/* Cursor */}
        <div
          className="absolute w-4 h-4 border-2 border-white rounded-full pointer-events-none"
          style={{
            left: `${cursorX}px`,
            top: `${cursorY}px`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
          }}
        />
      </div>

      {/* Hue Bar */}
      <div className="relative mb-4">
        <canvas
          ref={hueRef}
          width={PICKER_SIZE}
          height={HUE_HEIGHT}
          className="rounded cursor-pointer border border-border/50 w-full"
          style={{ height: `${HUE_HEIGHT}px` }}
          onMouseDown={handleHueMouseDown}
        />
        {/* Hue Cursor */}
        <div
          className="absolute w-3 h-6 border-2 border-white rounded pointer-events-none"
          style={{
            left: `${hueCursorX}px`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
          }}
        />
      </div>

      {/* Hex Input */}
      <div className="space-y-2">
        <Label htmlFor="hex-input" className="text-xs text-muted-foreground">
          HEX Color
        </Label>
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded border border-border/50 flex-shrink-0"
            style={{ backgroundColor: hexValue }}
          />
          <Input
            id="hex-input"
            value={hexValue}
            onChange={handleHexChange}
            placeholder="#000000"
            className="font-mono uppercase"
            maxLength={7}
          />
        </div>
      </div>
    </div>
  );
}

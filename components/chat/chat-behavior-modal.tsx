'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/hooks/use-settings';
import { ArrowLeft, Zap } from 'lucide-react';

interface ChatBehaviorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatBehaviorModal({
  open,
  onOpenChange,
}: ChatBehaviorModalProps) {
  const { settings, updateSettings } = useSettings();

  const handleTemperatureChange = (value: number[]) => {
    updateSettings({ chatTemperature: value[0] });
  };

  const handleSystemPromptChange = (value: string) => {
    updateSettings({ systemPrompt: value });
  };

  const getTemperatureLabel = (temp: number): string => {
    if (temp <= 0.5) return 'Focused';
    if (temp <= 1.0) return 'Balanced';
    return 'Creative';
  };

  const getTemperatureDescription = (temp: number): string => {
    if (temp <= 0.5) {
      return 'More deterministic and consistent responses. Best for factual questions and precise tasks.';
    }
    if (temp <= 1.0) {
      return 'Balanced creativity and consistency. Good for general conversation and varied tasks.';
    }
    return 'More creative and diverse responses. Best for brainstorming and creative writing.';
  };

  const systemPromptTemplates = [
    {
      name: 'Professional',
      prompt:
        'You are a professional assistant. Provide clear, concise, and well-structured responses. Use formal language and cite sources when applicable.',
    },
    {
      name: 'Casual',
      prompt:
        'You are a friendly and casual assistant. Use a conversational tone and feel free to use emojis when appropriate.',
    },
    {
      name: 'Technical',
      prompt:
        'You are a technical expert. Provide detailed, accurate explanations with code examples when relevant. Assume the user has technical knowledge.',
    },
    {
      name: 'Concise',
      prompt:
        'You are a concise assistant. Keep responses brief and to the point. Use bullet points when appropriate.',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0d11]/80 backdrop-blur-xl border border-[#57FCFF]/20 sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0 hover:bg-[#57FCFF]/10"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#57FCFF]" />
                Chat Behavior
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm mt-1">
                Configure how the AI responds to your messages
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Temperature slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Temperature</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {settings.chatTemperature.toFixed(1)}
                </span>
                <span className="text-xs font-medium text-[#57FCFF]">
                  {getTemperatureLabel(settings.chatTemperature)}
                </span>
              </div>
            </div>
            <Slider
              value={[settings.chatTemperature]}
              onValueChange={handleTemperatureChange}
              min={0}
              max={2}
              step={0.1}
              className="w-full"
            />
            
            {/* Temperature markers */}
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>0.0 - Focused</span>
              <span>1.0 - Balanced</span>
              <span>2.0 - Creative</span>
            </div>

            {/* Description */}
            <div className="bg-sidebar/30 border border-border/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                {getTemperatureDescription(settings.chatTemperature)}
              </p>
            </div>
          </div>

          {/* System prompt */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="system-prompt" className="text-sm font-medium">
                System Prompt
              </Label>
              <span className="text-xs text-muted-foreground">
                {settings.systemPrompt.length}/500
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Custom instructions that shape the AI's personality and behavior
            </p>
            <Textarea
              id="system-prompt"
              value={settings.systemPrompt}
              onChange={(e) => handleSystemPromptChange(e.target.value)}
              placeholder="e.g., You are a helpful technical assistant who explains concepts clearly..."
              maxLength={500}
              rows={5}
              className="resize-none font-mono text-sm"
            />

            {/* Templates */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Quick Templates
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {systemPromptTemplates.map((template) => (
                  <button
                    key={template.name}
                    onClick={() => handleSystemPromptChange(template.prompt)}
                    className="p-2 text-left rounded-lg border border-border/50 hover:border-[#57FCFF]/50 hover:bg-[#57FCFF]/5 transition-all"
                  >
                    <p className="text-xs font-medium">{template.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                      {template.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-sidebar/30 border border-border/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Note:</span> These
              settings apply globally to all new conversations. Changes won't
              affect existing conversations.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

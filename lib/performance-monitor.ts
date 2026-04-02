/**
 * Performance Monitor
 * Tracks FPS during interactions and suggests performance optimizations
 */

export interface PerformanceMetrics {
  fps: number;
  averageFps: number;
  frameTime: number;
  isPerformant: boolean;
}

export class PerformanceMonitor {
  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private fps: number = 60;
  private fpsHistory: number[] = [];
  private readonly historySize: number = 60; // Track last 60 frames
  private animationFrameId: number | null = null;
  private isMonitoring: boolean = false;
  private onLowPerformance?: (metrics: PerformanceMetrics) => void;
  private lowPerformanceThreshold: number = 30;
  private lowPerformanceDetectedAt: number | null = null;
  private readonly lowPerformanceDuration: number = 2000; // 2 seconds

  constructor(options?: {
    onLowPerformance?: (metrics: PerformanceMetrics) => void;
    threshold?: number;
  }) {
    this.onLowPerformance = options?.onLowPerformance;
    this.lowPerformanceThreshold = options?.threshold ?? 30;
  }

  /**
   * Start monitoring performance
   */
  start(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];
    this.lowPerformanceDetectedAt = null;
    
    this.measure();
  }

  /**
   * Stop monitoring performance
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const averageFps = this.getAverageFps();
    const frameTime = 1000 / this.fps;
    
    return {
      fps: Math.round(this.fps),
      averageFps: Math.round(averageFps),
      frameTime: Math.round(frameTime * 100) / 100,
      isPerformant: averageFps >= this.lowPerformanceThreshold,
    };
  }

  /**
   * Measure frame rate
   */
  private measure = (): void => {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const delta = currentTime - this.lastTime;
    
    if (delta >= 1000) {
      // Calculate FPS
      this.fps = (this.frameCount * 1000) / delta;
      this.fpsHistory.push(this.fps);
      
      // Keep history size limited
      if (this.fpsHistory.length > this.historySize) {
        this.fpsHistory.shift();
      }
      
      // Check for sustained low performance
      this.checkPerformance(currentTime);
      
      // Reset counters
      this.frameCount = 0;
      this.lastTime = currentTime;
    }
    
    this.frameCount++;
    this.animationFrameId = requestAnimationFrame(this.measure);
  };

  /**
   * Check if performance is below threshold
   */
  private checkPerformance(currentTime: number): void {
    const averageFps = this.getAverageFps();
    
    if (averageFps < this.lowPerformanceThreshold) {
      // Low performance detected
      if (this.lowPerformanceDetectedAt === null) {
        this.lowPerformanceDetectedAt = currentTime;
      } else if (currentTime - this.lowPerformanceDetectedAt >= this.lowPerformanceDuration) {
        // Low performance sustained for threshold duration
        if (this.onLowPerformance) {
          this.onLowPerformance(this.getMetrics());
        }
        // Reset to avoid repeated callbacks
        this.lowPerformanceDetectedAt = null;
      }
    } else {
      // Performance is good, reset detector
      this.lowPerformanceDetectedAt = null;
    }
  }

  /**
   * Calculate average FPS from history
   */
  private getAverageFps(): number {
    if (this.fpsHistory.length === 0) return 60;
    
    const sum = this.fpsHistory.reduce((acc, fps) => acc + fps, 0);
    return sum / this.fpsHistory.length;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];
    this.lowPerformanceDetectedAt = null;
  }

  /**
   * Check if currently monitoring
   */
  isActive(): boolean {
    return this.isMonitoring;
  }
}

/**
 * Hook for easy integration with React components
 * Usage in React component:
 * 
 * const monitor = usePerformanceMonitor({
 *   onLowPerformance: (metrics) => {
 *     toast.warning(`Low performance detected: ${metrics.averageFps} FPS`);
 *   }
 * });
 * 
 * // Start monitoring on drag
 * onMouseDown={() => monitor.start()}
 * onMouseUp={() => monitor.stop()}
 */
export function createPerformanceMonitor(options?: {
  onLowPerformance?: (metrics: PerformanceMetrics) => void;
  threshold?: number;
}): PerformanceMonitor {
  return new PerformanceMonitor(options);
}

#!/usr/bin/env python3
"""Compare TypeScript vs Go implementation performance metrics."""

import matplotlib.pyplot as plt
import numpy as np
from dataclasses import dataclass
from typing import List

@dataclass
class PerfMetric:
    operation: str
    ts_time_ms: float
    go_time_ms: float
    
    @property
    def speedup(self) -> float:
        return self.ts_time_ms / self.go_time_ms

# Session data will be collected here
metrics = [
    PerfMetric("Parse 1000 files", 0, 0),
    PerfMetric("Type check large project", 0, 0),
    PerfMetric("Incremental compilation", 0, 0),
    PerfMetric("Memory usage (MB)", 0, 0),
]

def plot_performance_comparison(metrics: List[PerfMetric]):
    """Create performance comparison visualization."""
    operations = [m.operation for m in metrics]
    ts_times = [m.ts_time_ms for m in metrics]
    go_times = [m.go_time_ms for m in metrics]
    
    x = np.arange(len(operations))
    width = 0.35
    
    fig, ax = plt.subplots(figsize=(10, 6))
    ts_bars = ax.bar(x - width/2, ts_times, width, label='TypeScript')
    go_bars = ax.bar(x + width/2, go_times, width, label='Go Port')
    
    ax.set_ylabel('Time (ms)')
    ax.set_title('TypeScript vs Go Implementation Performance')
    ax.set_xticks(x)
    ax.set_xticklabels(operations, rotation=45, ha='right')
    ax.legend()
    
    # Add speedup annotations
    for i, metric in enumerate(metrics):
        if metric.go_time_ms > 0:
            speedup = metric.speedup
            ax.text(i, max(ts_times[i], go_times[i]) * 1.05, 
                   f'{speedup:.1f}x', ha='center')
    
    plt.tight_layout()
    plt.savefig('../diagrams/ts-go-performance.png')
    
if __name__ == "__main__":
    # This will be filled during the session
    plot_performance_comparison(metrics)

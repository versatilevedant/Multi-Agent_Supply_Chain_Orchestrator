// ================================================================
// RaktaSetu — Lightweight Canvas Chart Library
// Draws line charts, bar charts, donut charts, area charts
// No external dependencies
// ================================================================

class ChartEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = {
      padding: { top: 30, right: 20, bottom: 40, left: 50 },
      colors: [
        '#1a237e', '#c62828', '#00897b', '#f9a825',
        '#5c6bc0', '#e57373', '#4db6ac', '#ffd54f',
        '#303f9f', '#ef5350', '#26a69a', '#ffca28'
      ],
      gridColor: '#e4e7ec',
      textColor: '#667085',
      fontFamily: 'Inter, sans-serif',
      animate: true,
      animationDuration: 800,
      ...options
    };
    this.animationProgress = 0;
    this.resizeCanvas();
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = (this.options.height || rect.height || 280) * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = (this.options.height || rect.height || 280) + 'px';
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = this.options.height || rect.height || 280;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  animate(drawFn) {
    if (!this.options.animate) {
      this.animationProgress = 1;
      drawFn(1);
      return;
    }
    const start = performance.now();
    const duration = this.options.animationDuration;
    const step = (timestamp) => {
      const elapsed = timestamp - start;
      this.animationProgress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - this.animationProgress, 3); // easeOutCubic
      this.clear();
      drawFn(eased);
      if (this.animationProgress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }

  // ── Line Chart ────────────────────────────────────
  drawLineChart(data) {
    // data: { labels: [], datasets: [{ label, data: [], color }] }
    const { padding, gridColor, textColor, fontFamily } = this.options;
    const chartWidth = this.width - padding.left - padding.right;
    const chartHeight = this.height - padding.top - padding.bottom;

    const allValues = data.datasets.flatMap(d => d.data);
    const minVal = Math.min(...allValues) * 0.9;
    const maxVal = Math.max(...allValues) * 1.1;
    const range = maxVal - minVal || 1;

    this.animate((progress) => {
      const ctx = this.ctx;
      
      // Grid lines
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
        
        // Y labels
        const val = maxVal - (range / 5) * i;
        ctx.fillStyle = textColor;
        ctx.font = `11px ${fontFamily}`;
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(val), padding.left - 8, y + 4);
      }

      // X labels
      ctx.textAlign = 'center';
      const step = Math.ceil(data.labels.length / 10);
      data.labels.forEach((label, i) => {
        if (i % step === 0) {
          const x = padding.left + (chartWidth / (data.labels.length - 1)) * i;
          ctx.fillStyle = textColor;
          ctx.fillText(label, x, this.height - padding.bottom + 20);
        }
      });

      // Draw datasets
      data.datasets.forEach((dataset, di) => {
        const color = dataset.color || this.options.colors[di];
        const points = dataset.data.map((val, i) => ({
          x: padding.left + (chartWidth / (dataset.data.length - 1)) * i,
          y: padding.top + chartHeight - ((val - minVal) / range) * chartHeight
        }));

        // Area fill
        if (dataset.fill) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, padding.top + chartHeight);
          points.forEach((p, i) => {
            const animY = padding.top + chartHeight - (padding.top + chartHeight - p.y) * progress;
            if (i === 0) ctx.lineTo(p.x, animY);
            else {
              const prev = points[i - 1];
              const cpx = (prev.x + p.x) / 2;
              const prevAnimY = padding.top + chartHeight - (padding.top + chartHeight - prev.y) * progress;
              ctx.bezierCurveTo(cpx, prevAnimY, cpx, animY, p.x, animY);
            }
          });
          ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
          ctx.closePath();
          ctx.fillStyle = color + '15';
          ctx.fill();
        }

        // Line
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        points.forEach((p, i) => {
          const animY = padding.top + chartHeight - (padding.top + chartHeight - p.y) * progress;
          if (i === 0) ctx.moveTo(p.x, animY);
          else {
            const prev = points[i - 1];
            const cpx = (prev.x + p.x) / 2;
            const prevAnimY = padding.top + chartHeight - (padding.top + chartHeight - prev.y) * progress;
            ctx.bezierCurveTo(cpx, prevAnimY, cpx, animY, p.x, animY);
          }
        });
        ctx.stroke();

        // Dots
        if (dataset.data.length <= 30) {
          points.forEach((p) => {
            const animY = padding.top + chartHeight - (padding.top + chartHeight - p.y) * progress;
            ctx.beginPath();
            ctx.arc(p.x, animY, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
          });
        }
      });

      // Legend
      if (data.datasets.length > 1) {
        let legendX = padding.left;
        data.datasets.forEach((dataset, di) => {
          const color = dataset.color || this.options.colors[di];
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(legendX + 6, 14, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = textColor;
          ctx.font = `11px ${fontFamily}`;
          ctx.textAlign = 'left';
          ctx.fillText(dataset.label, legendX + 14, 18);
          legendX += ctx.measureText(dataset.label).width + 30;
        });
      }
    });
  }

  // ── Bar Chart ─────────────────────────────────────
  drawBarChart(data) {
    const { padding, gridColor, textColor, fontFamily } = this.options;
    const chartWidth = this.width - padding.left - padding.right;
    const chartHeight = this.height - padding.top - padding.bottom;

    const maxVal = Math.max(...data.datasets.flatMap(d => d.data)) * 1.15;

    this.animate((progress) => {
      const ctx = this.ctx;
      const numBars = data.labels.length;
      const groupWidth = chartWidth / numBars;
      const barWidth = Math.min(groupWidth * 0.6 / data.datasets.length, 40);
      const groupOffset = (groupWidth - barWidth * data.datasets.length) / 2;

      // Grid
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        const val = maxVal - (maxVal / 5) * i;
        ctx.fillStyle = textColor;
        ctx.font = `11px ${fontFamily}`;
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(val), padding.left - 8, y + 4);
      }

      // Bars
      data.labels.forEach((label, i) => {
        const x = padding.left + groupWidth * i;
        
        data.datasets.forEach((dataset, di) => {
          const color = dataset.color || this.options.colors[di];
          const barHeight = (dataset.data[i] / maxVal) * chartHeight * progress;
          const bx = x + groupOffset + barWidth * di;
          const by = padding.top + chartHeight - barHeight;

          // Bar with rounded top
          ctx.fillStyle = color;
          ctx.beginPath();
          const r = Math.min(4, barWidth / 2);
          ctx.moveTo(bx, padding.top + chartHeight);
          ctx.lineTo(bx, by + r);
          ctx.quadraticCurveTo(bx, by, bx + r, by);
          ctx.lineTo(bx + barWidth - r, by);
          ctx.quadraticCurveTo(bx + barWidth, by, bx + barWidth, by + r);
          ctx.lineTo(bx + barWidth, padding.top + chartHeight);
          ctx.fill();
        });

        // X label
        ctx.fillStyle = textColor;
        ctx.font = `11px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText(label, x + groupWidth / 2, this.height - padding.bottom + 18);
      });
    });
  }

  // ── Donut Chart ───────────────────────────────────
  drawDonutChart(data, centerText = '') {
    const { textColor, fontFamily } = this.options;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = Math.min(cx, cy) - 30;
    const innerRadius = radius * 0.62;
    const total = data.reduce((sum, d) => sum + d.value, 0);

    this.animate((progress) => {
      const ctx = this.ctx;
      let startAngle = -Math.PI / 2;

      data.forEach((segment, i) => {
        const sliceAngle = (segment.value / total) * Math.PI * 2 * progress;
        const color = segment.color || this.options.colors[i];

        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
        ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Label
        if (progress > 0.8) {
          const midAngle = startAngle + sliceAngle / 2;
          const labelR = radius + 18;
          const lx = cx + Math.cos(midAngle) * labelR;
          const ly = cy + Math.sin(midAngle) * labelR;
          ctx.fillStyle = textColor;
          ctx.font = `11px ${fontFamily}`;
          ctx.textAlign = Math.cos(midAngle) > 0 ? 'left' : 'right';
          ctx.fillText(`${segment.label} (${((segment.value / total) * 100).toFixed(0)}%)`, lx, ly);
        }

        startAngle += sliceAngle;
      });

      // Center text
      if (centerText && progress > 0.5) {
        ctx.fillStyle = '#101828';
        ctx.font = `bold 22px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(centerText, cx, cy - 6);
        ctx.fillStyle = textColor;
        ctx.font = `12px ${fontFamily}`;
        ctx.fillText('Total Units', cx, cy + 16);
      }
    });
  }

  // ── Stacked Area Chart ────────────────────────────
  drawStackedAreaChart(data) {
    const { padding, gridColor, textColor, fontFamily } = this.options;
    const chartWidth = this.width - padding.left - padding.right;
    const chartHeight = this.height - padding.top - padding.bottom;

    // Calculate stacked totals
    const numPoints = data.labels.length;
    const stacked = data.datasets.map(d => [...d.data]);
    for (let d = data.datasets.length - 1; d > 0; d--) {
      for (let i = 0; i < numPoints; i++) {
        stacked[d][i] += stacked[d - 1][i];
      }
    }
    // Fix: cumulative from bottom
    const cumulative = [];
    for (let i = 0; i < numPoints; i++) {
      cumulative[i] = [0];
      for (let d = 0; d < data.datasets.length; d++) {
        cumulative[i].push(cumulative[i][d] + data.datasets[d].data[i]);
      }
    }
    const maxVal = Math.max(...cumulative.map(c => c[c.length - 1])) * 1.1;

    this.animate((progress) => {
      const ctx = this.ctx;
      
      // Grid
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
        const val = maxVal - (maxVal / 5) * i;
        ctx.fillStyle = textColor;
        ctx.font = `11px ${fontFamily}`;
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(val), padding.left - 8, y + 4);
      }

      // Draw areas from top dataset down
      for (let d = data.datasets.length - 1; d >= 0; d--) {
        const color = data.datasets[d].color || this.options.colors[d];
        ctx.beginPath();

        // Top line
        for (let i = 0; i < numPoints; i++) {
          const x = padding.left + (chartWidth / (numPoints - 1)) * i;
          const y = padding.top + chartHeight - (cumulative[i][d + 1] / maxVal) * chartHeight * progress;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        // Bottom line (reverse)
        for (let i = numPoints - 1; i >= 0; i--) {
          const x = padding.left + (chartWidth / (numPoints - 1)) * i;
          const y = padding.top + chartHeight - (cumulative[i][d] / maxVal) * chartHeight * progress;
          ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fillStyle = color + '60';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // X labels
      const step = Math.ceil(numPoints / 10);
      data.labels.forEach((label, i) => {
        if (i % step === 0) {
          const x = padding.left + (chartWidth / (numPoints - 1)) * i;
          ctx.fillStyle = textColor;
          ctx.font = `11px ${fontFamily}`;
          ctx.textAlign = 'center';
          ctx.fillText(label, x, this.height - padding.bottom + 18);
        }
      });

      // Legend
      let lx = padding.left;
      data.datasets.forEach((ds, di) => {
        const color = ds.color || this.options.colors[di];
        ctx.fillStyle = color + '80';
        ctx.fillRect(lx, 8, 14, 10);
        ctx.strokeStyle = color;
        ctx.strokeRect(lx, 8, 14, 10);
        ctx.fillStyle = textColor;
        ctx.font = `10px ${fontFamily}`;
        ctx.textAlign = 'left';
        ctx.fillText(ds.label, lx + 18, 17);
        lx += ctx.measureText(ds.label).width + 34;
      });
    });
  }

  // ── Gauge Chart ───────────────────────────────────
  drawGauge(value, max, label, color) {
    const cx = this.width / 2;
    const cy = this.height * 0.6;
    const radius = Math.min(cx, cy) - 20;
    const { textColor, fontFamily } = this.options;

    this.animate((progress) => {
      const ctx = this.ctx;
      const startAngle = Math.PI * 0.8;
      const endAngle = Math.PI * 2.2;
      const totalAngle = endAngle - startAngle;
      const valueAngle = startAngle + (value / max) * totalAngle * progress;

      // Background arc
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.strokeStyle = '#e4e7ec';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Value arc
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, valueAngle);
      ctx.strokeStyle = color;
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Value text
      ctx.fillStyle = '#101828';
      ctx.font = `bold 28px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(value * progress), cx, cy - 4);

      // Label
      ctx.fillStyle = textColor;
      ctx.font = `12px ${fontFamily}`;
      ctx.fillText(label, cx, cy + 24);
    });
  }
}

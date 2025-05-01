import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface StatusData {
  status: string;
  count: number;
}

interface DocumentStatusChartProps {
  data: StatusData[];
}

const colors = {
  pending: '#FBBF24',    // Amarillo
  processing: '#60A5FA', // Azul
  completed: '#34D399',  // Verde
  error: '#F87171',      // Rojo
};

const DocumentStatusChart = ({ data }: DocumentStatusChartProps) => {
  const chartRef = useRef<SVGSVGElement | null>(null);
  
  useEffect(() => {
    if (!data || data.length === 0 || !chartRef.current) return;
    
    // Limpiar cualquier gráfico anterior
    d3.select(chartRef.current).selectAll('*').remove();
    
    const width = chartRef.current.clientWidth;
    const height = chartRef.current.clientHeight;
    const radius = Math.min(width, height) / 2;
    
    const svg = d3.select(chartRef.current)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);
    
    const color = d3.scaleOrdinal<string>()
      .domain(data.map(d => d.status))
      .range(Object.values(data.map(d => colors[d.status as keyof typeof colors] || '#9CA3AF')));
    
    const pie = d3.pie<StatusData>()
      .value(d => d.count);
    
    const arc = d3.arc<d3.PieArcDatum<StatusData>>()
      .innerRadius(radius * 0.5)
      .outerRadius(radius * 0.8);
    
    const outerArc = d3.arc<d3.PieArcDatum<StatusData>>()
      .innerRadius(radius * 0.9)
      .outerRadius(radius * 0.9);
    
    const arcs = svg.selectAll('arc')
      .data(pie(data))
      .enter()
      .append('g')
      .attr('class', 'arc');
    
    // Add the arcs
    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.status) as string)
      .attr('stroke', 'white')
      .style('stroke-width', '2px')
      .style('opacity', 0.8);
    
    // Add labels
    arcs.append('text')
      .attr('transform', d => {
        const [x, y] = outerArc.centroid(d);
        const midAngle = Math.atan2(y, x);
        const textAnchor = Math.cos(midAngle) > 0 ? 'start' : 'end';
        return `translate(${radius * 0.95 * Math.cos(midAngle)}, ${radius * 0.95 * Math.sin(midAngle)}) rotate(${midAngle * 180 / Math.PI}) ${textAnchor === 'start' ? '' : 'rotate(180)'}`;
      })
      .attr('dy', '.35em')
      .attr('text-anchor', d => {
        const [x] = outerArc.centroid(d);
        return x > 0 ? 'start' : 'end';
      })
      .text(d => `${d.data.status}: ${d.data.count}`)
      .style('font-size', '12px')
      .style('fill', '#4B5563');
    
    // Add center text with total
    const total = data.reduce((acc, curr) => acc + curr.count, 0);
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.5em')
      .style('font-size', '16px')
      .style('fill', '#111827')
      .text('Total');
    
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .style('font-size', '24px')
      .style('font-weight', 'bold')
      .style('fill', '#111827')
      .text(total);
    
  }, [data]);
  
  return (
    <div className="w-full h-full">
      <svg ref={chartRef} width="100%" height="100%"></svg>
    </div>
  );
};

export default DocumentStatusChart;
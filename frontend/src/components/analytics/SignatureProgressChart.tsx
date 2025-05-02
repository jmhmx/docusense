import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface SignatureData {
  date: string;
  completed: number;
  pending: number;
}

interface SignatureProgressChartProps {
  data: SignatureData[];
}

const SignatureProgressChart = ({ data }: SignatureProgressChartProps) => {
  const chartRef = useRef<SVGSVGElement | null>(null);
  
  useEffect(() => {
    if (!data || data.length === 0 || !chartRef.current) return;
    
    // Limpiar cualquier gráfico anterior
    d3.select(chartRef.current).selectAll('*').remove();
    
    const width = chartRef.current.clientWidth;
    const height = chartRef.current.clientHeight;
    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const svg = d3.select(chartRef.current)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // Convert dates to JavaScript Date objects
    const parsedData = data.map(d => ({
      ...d,
      date: new Date(d.date)
    }));
    
    // Set up scales
    const xScale = d3.scaleBand()
      .domain(parsedData.map(d => d.date.toISOString()))
      .range([0, innerWidth])
      .padding(0.2);
    
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(parsedData, d => d.completed + d.pending) || 0])
      .nice()
      .range([innerHeight, 0]);
    
    // Create a stacked dataset
    const stackedData = parsedData.map(d => [
      { key: 'completed', value: d.completed, date: d.date },
      { key: 'pending', value: d.pending, date: d.date }
    ]);
    
    // Draw the bars
    stackedData.forEach((dateGroup) => {
      let y0 = 0;
      dateGroup.forEach(d => {
        svg.append('rect')
          //@ts-ignore
          .attr('x', xScale(d.date.toISOString()))
          .attr('y', yScale(d.value + y0))
          .attr('width', xScale.bandwidth())
          .attr('height', innerHeight - yScale(d.value || 0))
          .attr('fill', d.key === 'completed' ? '#34D399' : '#FBBF24')
          .attr('opacity', 0.8);
        
        y0 += d.value;
      });
    });
    
    // Add x-axis
    svg.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d => {
        const date = new Date(d as string);
        return date.toLocaleDateString();
      }))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');
    
    // Add y-axis
    svg.append('g')
      .call(d3.axisLeft(yScale));
    
    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(${innerWidth - 120}, 0)`);
    
    // Completed legend
    legend.append('rect')
      .attr('width', 18)
      .attr('height', 18)
      .attr('fill', '#34D399');
    
    legend.append('text')
      .attr('x', 24)
      .attr('y', 9)
      .attr('dy', '0.35em')
      .text('Completadas')
      .style('font-size', '12px');
    
    // Pending legend
    legend.append('rect')
      .attr('width', 18)
      .attr('height', 18)
      .attr('fill', '#FBBF24')
      .attr('y', 24);
    
    legend.append('text')
      .attr('x', 24)
      .attr('y', 33)
      .attr('dy', '0.35em')
      .text('Pendientes')
      .style('font-size', '12px');
    
  }, [data]);
  
  return (
    <div className="w-full h-full">
      <svg ref={chartRef} width="100%" height="100%"></svg>
    </div>
  );
};

export default SignatureProgressChart;
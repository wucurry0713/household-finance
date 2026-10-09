import "server-only";
import { useState, useEffect } from 'react';
import { loadAnalyticsTransactions } from "@/lib/finance/analytics";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { monthDateRange } from "@/lib/finance/month";

const AnalyticsPage = ({ supabase, householdId }: { supabase: SupabaseClient<Database>, householdId: string }) => {
  const [filter, setFilter] = useState('this_month');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [customStartDate, setCustomStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);

  const filterOptions = [
    { label: '本月', value: 'this_month' },
    { label: '近 6 個月', value: 'last_six_months' },
    { label: '今年', value: 'this_year' },
    { label: '自訂', value: 'custom' },
  ];

  const fetchData = async () => {
    if (filter === 'custom') {
      const since = customStartDate;
      const until = customEndDate;
      return loadAnalyticsTransactions(supabase, householdId, '', since, until);
    } else {
      const selectedMonth = filter;
      return loadAnalyticsTransactions(supabase, householdId, selectedMonth);
    }
  };

  useEffect(() => {
    fetchData().then(setData);
  }, [filter, customStartDate, customEndDate]);

  const handleFilterChange = (event) => {
    setFilter(event.target.value);
  };

  const handleDateChange = (event) => {
    if (event.target.id === 'custom-start-date') {
      setCustomStartDate(event.target.value);
    } else if (event.target.id === 'custom-end-date') {
      setCustomEndDate(event.target.value);
    }
  };

  const handleCustomFilter = () => {
    setFilter('custom');
  };

  return (
    <div>
      <div className="time-filter">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            className="filter-button"
            onClick={() => {
              if (option.value === 'custom') {
                handleCustomFilter();
              } else {
                setFilter(option.value);
              }
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filter === 'custom' && (
        <div id="custom-date-picker">
          <label htmlFor="custom-start-date">開始日期:</label>
          <input
            type="date"
            id="custom-start-date"
            name="custom-start-date"
            value={customStartDate}
            onChange={handleDateChange}
          />
          <label htmlFor="custom-end-date">結束日期:</label>
          <input
            type="date"
            id="custom-end-date"
            name="custom-end-date"
            value={customEndDate}
            onChange={handleDateChange}
          />
          <button onClick={() => fetchData()}>套用</button>
        </div>
      )}

      {data && (
        <div>
          <h2>總支出金額: {data.totalExpenditure}</h2>
          <div id="chart"></div>
          <table>
            <thead>
              <tr>
                <th>分類</th>
                <th>交易數量</th>
                <th>占比</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((category) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>{category.transactionCount}</td>
                  <td>{category.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
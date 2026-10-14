import io
p = 'frontend/src/pages/pos/POSDashboard.jsx'
src = io.open(p, 'r', encoding='utf-8').read()

# 1) Drop the old Spark + PromoBanner helper components
i = src.find('/* Mini sparkline (metric cards) */')
j = src.find('/* ═══════════════════════════════════════════════════════\n   CONTROL ROOM DASHBOARD')
assert i > 0 and j > i, (i, j)
src = src[:i] + src[j:]

# 2) Drop mapTab/selectedTable state
src = src.replace("  const [mapTab, setMapTab] = useState('floor');\n  const [selectedTableId, setSelectedTableId] = useState(null);\n", "")

# 3) Drop swipe navigation logic
i = src.find("  /* Live Service Map: Floor → Orders → Kitchen swipe navigation */")
j = src.find("  /* ── greeting ── */")
assert i > 0 and j > i, (i, j)
src = src[:i] + src[j:]

# 4) Drop selectedTable derived vars
src = src.replace("  const selectedTable = tables.find(t => t.id === selectedTableId) || null;\n  const selectedTableOrder = selectedTable ? orderForTable(selectedTable) : null;\n", "")

# 5) Replace RENDER→EOF with the reference layout
marker = "  /* ═════════ RENDER ═════════ */"
k = src.find(marker)
assert k > 0, "render marker missing"
head = src[:k]

tail = r'''  /* ═════════ RENDER ═════════ */

  /* Hourly sales (real orders → local-time buckets) */
  const hourlySales = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: 0 }));
    todayOrders.forEach(o => {
      if (o.status === 'cancelled') return;
      try {
        const h = new Date(o.created_at).getHours();
        buckets[h].sales += (o.total_amount || 0);
      } catch { /* skip malformed */ }
    });
    return buckets;
  }, [todayOrders]);

  const todaySales = todayOrders.filter(o => o.status !== 'cancelled').reduce((a, o) => a + (o.total_amount || 0), 0);
  const avgOrderValue = todayOrders.length > 0 ? todaySales / todayOrders.length : 0;
  const cancelledOrders = todayOrders.filter(o => o.status === 'cancelled');
  const servedOrders = todayOrders.filter(o => o.status === 'completed');
  const newOrders = todayOrders.filter(o => o.status === 'pending');

  /* Top selling items (real line items → revenue) */
  const topItems = useMemo(() => {
    const map = {};
    todayOrders.forEach(o => {
      if (o.status === 'cancelled') return;
      (o.items || []).forEach(it => {
        if (!map[it.name]) map[it.name] = { name: it.name, qty: 0, revenue: 0 };
        map[it.name].qty += (it.quantity || 0);
        map[it.name].revenue += (it.total || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [todayOrders]);

  const availableTables = tables.filter(t => t.status !== 'occupied' && t.status !== 'reserved');
  const reservedTables = tables.filter(t => t.status === 'reserved');
  const filteredTables = tableFilter === 'occupied' ? occupiedTables
    : tableFilter === 'available' ? availableTables
    : tableFilter === 'reserved' ? reservedTables
    : tables;

  const fmtHour = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'AM' : 'PM'}`;
  const fmtAxis = (v) => (v >= 1000 ? `₹${(v / 1000).toFixed(1).replace(/\.0$/, '')}K` : `₹${v}`);

  const statusRows = [
    { key: 'new', label: 'New Orders', count: newOrders.length, icon: ClipboardList, tone: 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-300' },
    { key: 'prep', label: 'Preparing', count: preparingOrders.length, icon: Flame, tone: 'bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-300' },
    { key: 'ready', label: 'Ready', count: readyOrders.length, icon: CheckCircle, tone: 'bg-blue-50 dark:bg-blue-400/10 text-blue-600 dark:text-blue-300' },
    { key: 'served', label: 'Served', count: servedOrders.length, icon: ConciergeBell, tone: 'bg-gray-100 dark:bg-white/[0.07] text-gray-500 dark:text-white/60' },
    { key: 'cancelled', label: 'Cancelled', count: cancelledOrders.length, icon: XCircle, tone: 'bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-300' },
  ];

  const quickLinks = [
    { label: 'Add Menu', icon: UtensilsCrossed, to: '/pos/menu' },
    { label: 'Manage Tables', icon: Monitor, to: '/pos/tables' },
    { label: 'Inventory', icon: Package, to: '/pos/inventory' },
    { label: 'Create Bill', icon: Receipt, to: '/pos/order-management' },
    { label: 'Add Customer', icon: Users, to: '/pos/customers' },
    { label: 'View Reports', icon: BarChart3, to: '/pos/analytics' },
  ];

  return (
    <div className="space-y-4 md:space-y-5 animate-fade-in max-w-[1400px]" data-testid="pos-dashboard">

      {/* ═══ GREETING + HERO BRAND BANNER ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,400px)] gap-4 items-stretch">
        <div className="flex flex-col justify-center">
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {greeting}, {firstName} <span aria-hidden="true">🌱</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-1.5">
            {isDayOpen ? "Everything looks good. Here's what's happening today." : 'Day is not open yet — open the day to start billing.'}
          </p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${hasData ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-white/45'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${hasData ? 'bg-emerald-500 animate-calm-pulse' : 'bg-gray-400'}`} />
              {hasData ? 'Live data' : 'No service yet'}
            </span>
            {attentionCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-600 dark:bg-red-400/10 dark:text-red-300">
                <AlertTriangle className="w-3 h-3" /> {attentionCount} need attention
              </span>
            )}
          </div>
        </div>

        {/* Brand hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F2417] via-[#1B5A38] to-[#2E9E5B] text-white p-5 md:p-6 min-h-[128px] flex flex-col justify-center" data-testid="hero-banner">
          <div className="absolute -right-8 -top-12 w-44 h-44 rounded-full bg-white/[0.07] pointer-events-none" aria-hidden="true" />
          <div className="absolute right-20 -bottom-16 w-40 h-40 rounded-full bg-white/[0.05] pointer-events-none" aria-hidden="true" />
          <h3 className="relative font-heading font-extrabold text-xl md:text-2xl leading-snug">Great food<br />brings people together.</h3>
          <p className="relative text-xs md:text-sm text-white/70 mt-1.5">Let's make today amazing!</p>
          <p className="relative font-script text-base md:text-lg text-emerald-200/85 self-end text-right leading-tight mt-1" aria-hidden="true">Good Food, Better People</p>
        </div>
      </div>

      {/* ═══ STAT CARDS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3.5">
        <button onClick={() => navigate('/pos/analytics')} className="text-left bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-3.5 md:p-4 hover:shadow-card-hover dark:hover:shadow-card-dark active:scale-[0.97] transition-all" data-testid="sales-today-card">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-400/10 flex items-center justify-center mb-2.5"><IndianRupee className="w-5 h-5 text-emerald-600 dark:text-emerald-300" /></div>
          <p className="text-[11px] font-semibold text-gray-500 dark:text-white/45">Today's Sales</p>
          <p className="font-numbers text-2xl font-bold text-gray-900 dark:text-white leading-tight"><CountUp value={todaySales} prefix="₹" /></p>
          <p className="text-[10px] mt-0.5 flex items-center gap-1 text-gray-400 dark:text-white/40">vs. yesterday {deltaChip(salesDelta)}</p>
        </button>

        <button onClick={() => setShowOrdersDetail(true)} className={`text-left bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-3.5 md:p-4 hover:shadow-card-hover dark:hover:shadow-card-dark active:scale-[0.97] transition-all ${newOrderPulse ? 'live-pulse' : ''}`} data-testid="total-orders-card">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-400/10 flex items-center justify-center mb-2.5"><ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-300" /></div>
          <p className="text-[11px] font-semibold text-gray-500 dark:text-white/45">Total Orders</p>
          <p className="font-numbers text-2xl font-bold text-gray-900 dark:text-white leading-tight"><CountUp value={todayOrders.length} /></p>
          <p className="text-[10px] mt-0.5 flex items-center gap-1 text-gray-400 dark:text-white/40">vs. yesterday {deltaChip(ordersDelta)}</p>
        </button>

        <div className="bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-3.5 md:p-4" data-testid="active-tables-card">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-400/10 flex items-center justify-center mb-2.5"><Users className="w-5 h-5 text-emerald-600 dark:text-emerald-300" /></div>
          <p className="text-[11px] font-semibold text-gray-500 dark:text-white/45">Active Tables</p>
          <p className="font-numbers text-2xl font-bold text-gray-900 dark:text-white leading-tight">{occupiedTables.length} / {tables.length}</p>
          <p className="text-[10px] mt-0.5 text-gray-400 dark:text-white/40 truncate">{occupiedTables.length} occupied · {availableTables.length} available</p>
        </div>

        <button onClick={() => navigate('/pos/inventory')} className="text-left bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-3.5 md:p-4 hover:shadow-card-hover dark:hover:shadow-card-dark active:scale-[0.97] transition-all" data-testid="low-stock-card">
          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-400/10 flex items-center justify-center mb-2.5"><Package className="w-5 h-5 text-red-500" /></div>
          <p className="text-[11px] font-semibold text-gray-500 dark:text-white/45">Low Stock Items</p>
          <p className="font-numbers text-2xl font-bold text-gray-900 dark:text-white leading-tight">{lowStockItems.length}</p>
          <p className="text-[10px] mt-0.5 text-gray-400 dark:text-white/40">{lowStockItems.length > 0 ? 'Need attention' : 'All stocked up'}</p>
        </button>
      </div>

      {/* ═══ DAY CLOSED NOTE ═══ */}
      {!isDayOpen && (
        <div className="bg-amber-50/70 dark:bg-amber-400/[0.07] border border-amber-200/70 dark:border-amber-400/20 rounded-2xl px-4 py-3 flex items-center gap-3 text-sm" data-testid="day-closed-banner">
          <Timer className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-amber-800 dark:text-amber-200 flex-1 min-w-0">Day is not open yet — billing is paused until you open the day.</p>
          <button
            onClick={async () => {
              try {
                await daySessionAPI.open(0);
                toast.success('Day opened — good service! 🌱');
                haptics.success();
                refreshSession();
              } catch { toast.error('Could not open the day — try again'); }
            }}
            className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-[#0F2417] dark:bg-[#2E9E5B] text-white text-xs font-bold hover:brightness-110 active:scale-[0.97] transition-all min-h-[40px]"
            data-testid="open-day-banner-btn"
          >
            Open Day
          </button>
        </div>
      )}

      {/* ═══ SALES OVERVIEW + ORDER STATUS + QUICK ACTIONS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Sales Overview */}
        <div className="bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-4 md:p-5" data-testid="sales-overview-card">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <h2 className="font-heading font-bold text-gray-900 dark:text-white text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#268A4E] dark:text-[#3FCE85]" /> Sales Overview</h2>
              <p className="text-[11px] text-gray-400 dark:text-white/40 mt-0.5">Real-time sales movement</p>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-white/50 border border-gray-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1"><CalendarDays className="w-3.5 h-3.5" /> Today</span>
          </div>
          <div className="h-40 mt-2" data-testid="sales-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlySales.filter(b => b.hour >= 7 && b.hour <= 23)} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="hour" tickFormatter={(h) => fmtHour(h)} tick={{ fontSize: 9 }} interval={3} axisLine={false} tickLine={false} stroke="#9CA3AF" />
                <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} stroke="#9CA3AF" />
                <Tooltip
                  formatter={(v) => [`₹${Number(v).toFixed(2)}`, 'Sales']}
                  labelFormatter={(h) => fmtHour(h)}
                  contentStyle={{ borderRadius: 12, border: '1px solid rgba(128,128,128,0.2)', fontSize: 12, background: '#0F2417', color: '#fff' }}
                  cursor={{ fill: 'rgba(46,158,91,0.08)' }}
                />
                <Bar dataKey="sales" fill="#2E9E5B" radius={[5, 5, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Summary tiles */}
          <div className="space-y-2 mt-3">
            <div className="flex items-center justify-between bg-gray-50 dark:bg-white/[0.04] rounded-xl px-3.5 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-400/10 flex items-center justify-center"><Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-300" /></div>
                <span className="text-xs font-semibold text-gray-500 dark:text-white/50">Total Sales</span>
              </div>
              <span className="font-numbers text-base font-bold text-gray-900 dark:text-white">₹{todaySales.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between bg-gray-50 dark:bg-white/[0.04] rounded-xl px-3.5 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-400/10 flex items-center justify-center"><ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-300" /></div>
                <span className="text-xs font-semibold text-gray-500 dark:text-white/50">Total Orders</span>
              </div>
              <span className="font-numbers text-base font-bold text-gray-900 dark:text-white">{todayOrders.length}</span>
            </div>
            <div className="flex items-center justify-between bg-gray-50 dark:bg-white/[0.04] rounded-xl px-3.5 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-400/10 flex items-center justify-center"><IndianRupee className="w-4 h-4 text-amber-600 dark:text-amber-300" /></div>
                <span className="text-xs font-semibold text-gray-500 dark:text-white/50">Avg. Order Value</span>
              </div>
              <span className="font-numbers text-base font-bold text-gray-900 dark:text-white">₹{avgOrderValue.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Order Status */}
        <div className="bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-4 md:p-5" data-testid="order-status-card">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="font-heading font-bold text-gray-900 dark:text-white text-base flex items-center gap-2"><ClipboardList className="w-4 h-4 text-[#268A4E] dark:text-[#3FCE85]" /> Order Status</h2>
              <p className="text-[11px] text-gray-400 dark:text-white/40 mt-0.5">Live kitchen updates</p>
            </div>
            <button onClick={() => setShowOrdersDetail(true)} className="text-xs font-semibold text-[#268A4E] dark:text-[#3FCE85] hover:underline flex items-center gap-0.5">View All <ArrowRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-1">
            {statusRows.map(row => (
              <button key={row.key} onClick={() => navigate('/pos/kds')} className="w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors text-left" data-testid={`status-row-${row.key}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${row.tone}`}><row.icon className="w-5 h-5" strokeWidth={1.9} /></div>
                <span className="text-sm font-semibold text-gray-800 dark:text-white/85 flex-1">{row.label}</span>
                <span className="font-numbers text-base font-bold text-gray-900 dark:text-white">{row.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-4 md:p-5" data-testid="quick-actions-card">
          <div className="mb-3">
            <h2 className="font-heading font-bold text-gray-900 dark:text-white text-base flex items-center gap-2"><Zap className="w-4 h-4 text-[#268A4E] dark:text-[#3FCE85]" /> Quick Actions</h2>
            <p className="text-[11px] text-gray-400 dark:text-white/40 mt-0.5">Get things done faster</p>
          </div>
          <button onClick={() => navigate('/pos/orders')} className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#2E9E5B] text-white hover:brightness-105 active:scale-[0.98] transition-all mb-3" data-testid="quick-new-order">
            <span className="flex items-center gap-3"><span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center"><Plus className="w-5 h-5" /></span><span className="text-sm font-bold">New Order</span></span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="grid grid-cols-3 gap-2">
            {quickLinks.map(l => (
              <button key={l.label} onClick={() => navigate(l.to)} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 dark:border-white/[0.08] hover:border-[#2E9E5B]/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-400/[0.06] active:scale-[0.97] transition-all" data-testid={`quick-${l.label.toLowerCase().replace(/\s+/g, '-')}`}>
                <l.icon className="w-5 h-5 text-gray-600 dark:text-white/60" strokeWidth={1.8} />
                <span className="text-[10px] font-bold text-gray-700 dark:text-white/70 text-center leading-tight">{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ ACTIVE TABLES + TOP SELLING + INVENTORY ALERTS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Active Tables */}
        <div className="bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-4 md:p-5" data-testid="active-tables-panel">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="font-heading font-bold text-gray-900 dark:text-white text-base flex items-center gap-2"><Monitor className="w-4 h-4 text-[#268A4E] dark:text-[#3FCE85]" /> Active Tables</h2>
              <p className="text-[11px] text-gray-400 dark:text-white/40 mt-0.5">Live table status</p>
            </div>
            <button onClick={() => navigate('/pos/tables')} className="text-xs font-semibold text-[#268A4E] dark:text-[#3FCE85] hover:underline flex items-center gap-0.5">View All <ArrowRight className="w-3 h-3" /></button>
          </div>
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {[{ k: 'all', l: `All (${tables.length})` }, { k: 'occupied', l: `Occupied (${occupiedTables.length})` }, { k: 'available', l: `Available (${availableTables.length})` }, { k: 'reserved', l: `Reserved (${reservedTables.length})` }].map(f => (
              <button key={f.k} onClick={() => setTableFilter(f.k)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${tableFilter === f.k ? 'bg-[#0F2417] dark:bg-[#2E9E5B] text-white' : 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-white/60 hover:bg-gray-200 dark:hover:bg-white/[0.1]'}`} data-testid={`table-filter-${f.k}`}>{f.l}</button>
            ))}
          </div>
          {tables.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-semibold text-gray-700 dark:text-white/70">No tables yet</p>
              <p className="text-xs text-gray-400 dark:text-white/40 mt-1 mb-3">Add tables to see your live floor.</p>
              <button onClick={() => navigate('/pos/tables')} className="px-4 py-2 rounded-xl bg-[#2E9E5B] text-white text-xs font-bold hover:brightness-105 transition-all">Go to Tables</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5" data-testid="active-tables-grid">
              {filteredTables.slice(0, 8).map((table) => {
                const vis = tableVisual(table, orderForTable(table));
                return (
                  <div
                    key={table.id}
                    onContextMenu={(e) => { e.preventDefault(); setLongPressTable(table); }}
                    onTouchStart={() => startTableLongPress(table)}
                    onTouchEnd={cancelTableLongPress}
                    onTouchMove={cancelTableLongPress}
                    className={`relative rounded-2xl p-3 ring-1 ${vis.ring} cursor-pointer select-none`}
                    data-testid={`table-card-${table.table_number}`}
                    title="Long-press / right-click for quick actions"
                  >
                    <div className="flex items-start justify-between">
                      <p className="font-numbers font-bold text-sm text-gray-900 dark:text-white leading-none">T{String(table.table_number).padStart(2, '0')}</p>
                      <MoreHorizontal className="w-3.5 h-3.5 text-gray-400 dark:text-white/30" />
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-white/40 mt-1">{table.capacity} seats</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${vis.chip}`} />
                      <span className={`text-[10px] font-bold ${vis.label === 'Available' ? 'text-emerald-600 dark:text-emerald-300' : vis.label === 'Payment' ? 'text-red-500' : 'text-gray-700 dark:text-white/70'}`}>{vis.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Selling Items */}
        <div className="bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-4 md:p-5" data-testid="top-items-panel">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="font-heading font-bold text-gray-900 dark:text-white text-base flex items-center gap-2"><UtensilsCrossed className="w-4 h-4 text-[#268A4E] dark:text-[#3FCE85]" /> Top Selling Items</h2>
              <p className="text-[11px] text-gray-400 dark:text-white/40 mt-0.5">Today's most ordered items</p>
            </div>
            <button onClick={() => navigate('/pos/analytics')} className="text-xs font-semibold text-[#268A4E] dark:text-[#3FCE85] hover:underline flex items-center gap-0.5">View All <ArrowRight className="w-3 h-3" /></button>
          </div>
          {topItems.length === 0 ? (
            <div className="py-10 text-center" data-testid="top-items-empty">
              <p className="text-sm font-semibold text-gray-700 dark:text-white/70">No sales yet today</p>
              <p className="text-xs text-gray-400 dark:text-white/40 mt-1">Your best sellers will show up here.</p>
            </div>
          ) : (
            <div className="space-y-1" data-testid="top-items-list">
              {topItems.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-3 py-2 px-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300' : idx === 1 ? 'bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300' : idx === 2 ? 'bg-orange-50 text-orange-600 dark:bg-orange-400/10 dark:text-orange-300' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.07] dark:text-white/50'}`}>{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-white/40">{item.qty} orders</p>
                  </div>
                  <span className="font-numbers text-sm font-bold text-gray-900 dark:text-white">₹{item.revenue.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inventory Alerts */}
        <div className="bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-4 md:p-5" data-testid="inventory-alerts-panel">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="font-heading font-bold text-gray-900 dark:text-white text-base flex items-center gap-2"><Package className="w-4 h-4 text-[#268A4E] dark:text-[#3FCE85]" /> Inventory Alerts</h2>
              <p className="text-[11px] text-gray-400 dark:text-white/40 mt-0.5">Items running low</p>
            </div>
            <button onClick={() => navigate('/pos/inventory')} className="text-xs font-semibold text-[#268A4E] dark:text-[#3FCE85] hover:underline flex items-center gap-0.5">View All <ArrowRight className="w-3 h-3" /></button>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="py-10 text-center" data-testid="inventory-alerts-empty">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700 dark:text-white/70">Everything stocked</p>
              <p className="text-xs text-gray-400 dark:text-white/40 mt-1">No low stock alerts right now.</p>
            </div>
          ) : (
            <div className="space-y-1" data-testid="inventory-alerts-list">
              {lowStockItems.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center gap-3 py-2 px-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-400/10 flex items-center justify-center flex-shrink-0"><Package className="w-4 h-4 text-red-500" /></div>
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white flex-1 truncate">{item.name}</p>
                  <span className="font-numbers text-xs font-bold text-red-500">{item.quantity} {item.unit || ''} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ FOOTER STRIP ═══ */}
      <div className="bg-white dark:bg-[#12151B] border border-gray-200 dark:border-white/[0.07] rounded-2xl px-4 md:px-5 py-3.5 flex flex-col md:flex-row md:items-center gap-3" data-testid="dashboard-footer">
        <p className="font-script text-lg text-[#1B5A38] dark:text-[#3FCE85] flex-1">🌿 A well-run kitchen is a happy kitchen.</p>
        <div className="flex items-center gap-2.5 text-xs">
          <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0"><CheckCircle className="w-3.5 h-3.5 text-white" /></span>
          <div className="leading-tight">
            <p className="font-bold text-gray-900 dark:text-white">All Systems Operational</p>
            <p className="text-[10px] text-gray-400 dark:text-white/40">POS · Kitchen · Inventory · Online Orders</p>
          </div>
        </div>
        <div className="text-right leading-tight md:ml-4">
          <p className="font-heading font-extrabold text-sm text-gray-900 dark:text-white">DineDesk</p>
          <p className="text-[10px] text-gray-400 dark:text-white/40">Version 1.0.0</p>
        </div>
      </div>

      {/* ═══ TODAY'S ORDERS DETAIL (metric card click) ═══ */}
      <Dialog open={showOrdersDetail} onOpenChange={setShowOrdersDetail}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="orders-detail-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" /> Today's Orders ({todayOrders.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {todayOrders.length === 0 ? (
              <p className="text-gray-400 dark:text-white/40 text-center py-8">No orders today yet.</p>
            ) : (
              todayOrders.map((order) => {
                const PmIcon = order.payment_method === 'cash' ? Banknote : order.payment_method === 'card' ? CreditCard : order.payment_method === 'upi' ? Smartphone : Clock;
                const st = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                return (
                  <div key={order.id} className="bg-gray-50 dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.07] p-4" data-testid={`order-detail-${order.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-numbers text-sm font-bold text-gray-900 dark:text-white">#{order.order_number}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${order.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-gray-200 text-gray-600 dark:bg-white/[0.08] dark:text-white/60'}`}>{order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-white/45">
                          <PmIcon className="w-3 h-3" />
                          <span className="capitalize">{order.payment_method || 'pending'}</span>
                          {order.table_number && <span>· Table {order.table_number}</span>}
                          <span>· {getOrderTime(order)}</span>
                        </div>
                      </div>
                      <p className="text-lg font-bold font-numbers text-gray-900 dark:text-white">₹{order.total_amount?.toFixed(2)}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mb-3">
                      {(order.items || []).map((item, idx) => (
                        <div key={`${item.name}-${item.quantity}-${idx}`} className="bg-white dark:bg-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs border border-gray-100 dark:border-white/[0.06]">
                          <span className="font-semibold text-gray-800 dark:text-white/85">{item.quantity}x</span>{' '}
                          <span className="text-gray-600 dark:text-white/60">{item.name}</span>
                          <span className="text-gray-400 dark:text-white/35 ml-1">₹{item.total?.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => openReceipt(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-[#2E9E5B] text-white text-xs font-semibold hover:bg-gray-800 dark:hover:bg-[#288A50] transition-colors"
                      data-testid={`view-receipt-${order.id}`}
                    >
                      <Printer className="w-3.5 h-3.5" /> View / Print Bill
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ RECEIPT MODAL (logic preserved) ═══ */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="rounded-2xl max-w-xs bg-white" data-testid="dashboard-receipt-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" /> Bill / Receipt
            </DialogTitle>
          </DialogHeader>
          {receiptData && (
            <div ref={receiptRef}>
              <div className="text-center border-b border-dashed border-gray-300 pb-2 mb-2">
                <h2 className="font-bold text-base text-gray-900">{receiptData.restaurant.name}</h2>
                <p className="text-[10px] text-gray-500">{receiptData.restaurant.address}, {receiptData.restaurant.city}</p>
                <p className="text-[10px] text-gray-500">{receiptData.restaurant.phone}</p>
              </div>
              <div className="text-[11px] mb-2 text-gray-800">
                <div className="flex justify-between"><span>Order #</span><span className="font-numbers">{receiptData.order.order_number}</span></div>
                <div className="flex justify-between"><span>Type</span><span className="capitalize">{receiptData.order.order_type?.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span>Payment</span><span className="capitalize">{receiptData.order.payment_method}</span></div>
                <div className="flex justify-between"><span>Date</span><span>{new Date(receiptData.order.created_at).toLocaleString()}</span></div>
                {receiptData.order.table_number && (
                  <div className="flex justify-between"><span>Table</span><span>{receiptData.order.table_number}</span></div>
                )}
              </div>
              <hr className="border-dashed border-gray-300 my-1" />
              <div className="space-y-1 text-[11px] text-gray-800">
                {(receiptData.order.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.quantity}x {item.name}</span>
                    <span>₹{item.total?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <hr className="border-dashed border-gray-300 my-1" />
              <div className="text-[11px] space-y-0.5 text-gray-800">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{receiptData.order.subtotal?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>₹{receiptData.order.tax_amount?.toFixed(2)}</span></div>
                {receiptData.order.discount_amount > 0 && (
                  <div className="flex justify-between"><span>Discount</span><span>-₹{receiptData.order.discount_amount?.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-gray-300">
                  <span>Total</span><span className="font-numbers">₹{receiptData.order.total_amount?.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-center text-[9px] text-gray-400 mt-3">Thank you for dining with us!</p>
            </div>
          )}
          <button
            onClick={handlePrintReceipt}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-50 transition-colors mt-2"
            data-testid="dashboard-print-receipt-btn"
          >
            <Printer className="w-4 h-4" /> Print Receipt
          </button>
        </DialogContent>
      </Dialog>

      {/* ── Long-press table quick actions ── */}
      <Dialog open={!!longPressTable} onOpenChange={(open) => { if (!open) setLongPressTable(null); }}>
        <DialogContent className="rounded-2xl max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">
              Table {longPressTable ? String(longPressTable.table_number).padStart(2, '0') : ''}
            </DialogTitle>
            <p className="text-xs text-gray-400">Quick actions</p>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2" data-testid="table-quick-actions">
            {[
              { action: 'available', label: 'Free up', tone: 'bg-gray-50 dark:bg-white/[0.05] text-gray-700 dark:text-white/70 border-gray-200 dark:border-white/[0.08]' },
              { action: 'occupied', label: 'Seat now', tone: 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-400/20' },
              { action: 'reserved', label: 'Reserve', tone: 'bg-blue-50 dark:bg-blue-400/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-400/20' },
              { action: 'available', label: 'Reset', tone: 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-400/20' },
            ].map(({ action, label, tone }) => (
              <button
                key={label}
                onClick={() => applyTableAction(action)}
                disabled={tableActionLoading}
                className={`py-3 rounded-xl border text-xs font-bold active:scale-95 transition-all disabled:opacity-50 ${tone}`}
                data-testid={`table-action-${label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {label}
              </button>
            ))}
          </div>
          {longPressTable && longPressTable.capacity && (
            <p className="text-[11px] text-gray-400 text-center">{longPressTable.capacity} seats</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Ask DineDesk — AI assistant lives on the Dashboard only */}
      <AskDineDesk />
    </div>
  );
}
'''

io.open(p, 'w', encoding='utf-8', newline='').write(head + tail)
print('dashboard rewritten, total lines:', (head + tail).count('\n') + 1)

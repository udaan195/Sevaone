// ============================================================
// FILE: src/screens/Main/JobCalendar.js
// Job Deadline Calendar — mark karo kab apply karna hai
// ============================================================
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, SafeAreaView, StatusBar, ActivityIndicator,
  Modal, ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { db, auth } from '../../api/firebaseConfig';
import { collection, getDocs, query, doc, getDoc } from 'firebase/firestore';
import { useAppTheme } from '../../context/ThemeContext';

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

// Parse date string — multiple formats support
function parseDate(str) {
  if (!str) return null;
  try {
    // DD-MM-YYYY or DD/MM/YYYY
    const parts = str.split(/[-\/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return new Date(parts[0], parts[1]-1, parts[2]); // YYYY-MM-DD
      if (parts[2].length === 4) return new Date(parts[2], parts[1]-1, parts[0]); // DD-MM-YYYY
    }
    const d = new Date(str);
    return isNaN(d) ? null : d;
  } catch { return null; }
}

export default function JobCalendar({ navigation }) {
  const { theme } = useAppTheme();
  const today     = new Date();
  const uid       = auth.currentUser?.uid;

  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth());
  const [jobs, setJobs]           = useState([]);
  const [bookmarked, setBookmarked] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayModal, setDayModal]   = useState(false);

  // Fetch all jobs + bookmarked
  useEffect(() => {
    const load = async () => {
      try {
        const [jobSnap, userSnap] = await Promise.all([
          getDocs(collection(db, 'gov_jobs')),
          uid ? getDoc(doc(db, 'users', uid)) : Promise.resolve(null),
        ]);
        const allJobs = jobSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setJobs(allJobs);
        if (userSnap?.exists()) {
          setBookmarked(userSnap.data().bookmarkedJobs || []);
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [uid]);

  // Map dates to jobs
  const dateMap = useMemo(() => {
    const map = {};
    jobs.forEach(job => {
      // lastDate field check
      const fields = job.importantDates || [];
      const dates  = [];

      // Check importantDates array
      fields.forEach(f => {
        const d = parseDate(f.value || f.date);
        if (d) dates.push({ date: d, label: f.label || f.title || 'Last Date', job });
      });

      // Check lastDate field directly
      const ld = parseDate(job.lastDate);
      if (ld) dates.push({ date: ld, label: 'Last Date', job });

      dates.forEach(({ date, label, job: j }) => {
        if (!date) return;
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        if (!map[key]) map[key] = [];
        map[key].push({ label, job: j });
      });
    });
    return map;
  }, [jobs]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [year, month]);

  const getDayEvents = (day) => {
    if (!day) return [];
    return dateMap[`${year}-${month}-${day}`] || [];
  };

  const isToday = (day) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const isPast = (day) => {
    const d = new Date(year, month, day);
    d.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    return d < t;
  };

  const getDayColor = (events) => {
    if (!events.length) return null;
    const hasUrgent = events.some(e => {
      const d = new Date(year, month, selectedDate || 1);
      const diff = (d - new Date()) / (1000*60*60*24);
      return diff <= 3;
    });
    return hasUrgent ? '#EF4444' : '#F59E0B';
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const openDay = (day) => {
    if (!day) return;
    setSelectedDate(day);
    setDayModal(true);
  };

  const selectedEvents = selectedDate ? getDayEvents(selectedDate) : [];

  const urgentJobs = useMemo(() => {
    const result = [];
    const now = new Date();
    Object.entries(dateMap).forEach(([key, events]) => {
      events.forEach(({ label, job }) => {
        const [y, m, d] = key.split('-').map(Number);
        const date = new Date(y, m, d);
        const diff = Math.ceil((date - now) / (1000*60*60*24));
        if (diff >= 0 && diff <= 7) result.push({ label, job, date, diff });
      });
    });
    return result.sort((a, b) => a.diff - b.diff);
  }, [dateMap]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor="#002855" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Job Calendar</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#002855" />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Month navigator */}
          <View style={[s.monthNav, { backgroundColor: theme.card }]}>
            <TouchableOpacity style={s.navBtn} onPress={prevMonth}>
              <MaterialCommunityIcons name="chevron-left" size={24} color="#002855" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={[s.monthTitle, { color: theme.text }]}>
                {MONTHS[month]} {year}
              </Text>
              <Text style={[s.monthSub, { color: theme.textMuted }]}>
                {Object.keys(dateMap).filter(k => k.startsWith(`${year}-${month}-`)).length} deadlines this month
              </Text>
            </View>
            <TouchableOpacity style={s.navBtn} onPress={nextMonth}>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#002855" />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={[s.dayHeaders, { backgroundColor: theme.card }]}>
            {DAYS.map(d => (
              <Text key={d} style={[s.dayHeader, { color: theme.textMuted }]}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={[s.grid, { backgroundColor: theme.card }]}>
            {calendarDays.map((day, idx) => {
              const events = getDayEvents(day);
              const todayFlag = day && isToday(day);
              const pastFlag  = day && isPast(day);
              const hasEvents = events.length > 0;
              const dotColor  = hasEvents
                ? (pastFlag ? '#94A3B8' : events.length > 0 ? '#EF4444' : '#F59E0B')
                : null;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[s.dayCell, {
                    backgroundColor: todayFlag ? '#002855' : 'transparent',
                  }]}
                  onPress={() => day && openDay(day)}
                  activeOpacity={day ? 0.7 : 1}
                >
                  {day ? (
                    <>
                      <Text style={[s.dayNum, {
                        color:      todayFlag ? '#fff' : pastFlag ? '#CBD5E1' : theme.text,
                        fontWeight: todayFlag || hasEvents ? '900' : '500',
                      }]}>
                        {day}
                      </Text>
                      {hasEvents && (
                        <View style={s.dotsRow}>
                          {events.slice(0, 3).map((_, i) => (
                            <View key={i} style={[s.dot, {
                              backgroundColor: pastFlag ? '#CBD5E1'
                                : events.length > 1 ? '#EF4444' : '#F59E0B',
                            }]} />
                          ))}
                        </View>
                      )}
                    </>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Urgent — this week */}
          {urgentJobs.length > 0 && (
            <View style={{ padding: 16 }}>
              <View style={s.sectionHead}>
                <MaterialCommunityIcons name="alert-circle" size={18} color="#EF4444" />
                <Text style={[s.sectionTitle, { color: theme.text }]}>
                  Urgent — This Week
                </Text>
              </View>
              {urgentJobs.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.urgentCard, { backgroundColor: theme.card }]}
                  onPress={() => navigation.navigate('JobDetails', { jobId: item.job.id })}
                  activeOpacity={0.85}
                >
                  <View style={[s.urgentBadge, {
                    backgroundColor: item.diff === 0 ? '#FEE2E2'
                      : item.diff <= 2 ? '#FEF3C7' : '#ECFDF5',
                  }]}>
                    <Text style={[s.urgentDays, {
                      color: item.diff === 0 ? '#DC2626'
                        : item.diff <= 2 ? '#92400E' : '#065F46',
                    }]}>
                      {item.diff === 0 ? 'TODAY' : `${item.diff}d`}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.urgentTitle, { color: theme.text }]} numberOfLines={1}>
                      {item.job.title}
                    </Text>
                    <Text style={[s.urgentLabel, { color: theme.textMuted }]}>
                      {item.label} — {item.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={theme.border} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Legend */}
          <View style={[s.legend, { backgroundColor: theme.card }]}>
            {[
              { color: '#EF4444', label: 'Multiple/Urgent deadlines' },
              { color: '#F59E0B', label: 'Single deadline' },
              { color: '#002855', label: 'Today' },
            ].map((item, i) => (
              <View key={i} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: item.color }]} />
                <Text style={[s.legendText, { color: theme.textMuted }]}>{item.label}</Text>
              </View>
            ))}
          </View>

        </ScrollView>
      )}

      {/* Day Modal */}
      <Modal visible={dayModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: theme.card }]}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, { color: theme.text }]}>
              {selectedDate} {MONTHS[month]} {year}
            </Text>
            {selectedEvents.length === 0 ? (
              <View style={s.emptyDay}>
                <MaterialCommunityIcons name="calendar-check" size={44} color="#E2E8F0" />
                <Text style={{ color: theme.textMuted, fontWeight: '700', marginTop: 12 }}>
                  No deadlines on this date
                </Text>
              </View>
            ) : (
              <ScrollView>
                {selectedEvents.map((event, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.eventCard, { backgroundColor: theme.surface }]}
                    onPress={() => {
                      setDayModal(false);
                      navigation.navigate('JobDetails', { jobId: event.job.id });
                    }}
                  >
                    <View style={s.eventLeft}>
                      <MaterialCommunityIcons name="briefcase" size={20} color="#002855" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[s.eventTitle, { color: theme.text }]} numberOfLines={2}>
                        {event.job.title}
                      </Text>
                      <Text style={[s.eventLabel, { color: '#EF4444' }]}>
                        ⚠️ {event.label}
                      </Text>
                      {event.job.conductedBy && (
                        <Text style={[s.eventOrg, { color: theme.textMuted }]}>
                          {event.job.conductedBy}
                        </Text>
                      )}
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={theme.border} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={s.closeBtn} onPress={() => setDayModal(false)}>
              <Text style={s.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#002855', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },

  monthNav:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, marginHorizontal: 16, marginTop: 16, borderRadius: 20, elevation: 1 },
  navBtn:      { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center' },
  monthTitle:  { fontSize: 18, fontWeight: '900' },
  monthSub:    { fontSize: 11, fontWeight: '600', marginTop: 2 },

  dayHeaders:  { flexDirection: 'row', marginHorizontal: 16, marginTop: 8, paddingVertical: 10, borderRadius: '12px 12px 0 0', paddingHorizontal: 4 },
  dayHeader:   { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  grid:        { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, borderRadius: '0 0 20px 20px', paddingBottom: 12, paddingHorizontal: 4, elevation: 1 },
  dayCell:     { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  dayNum:      { fontSize: 14 },
  dotsRow:     { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot:         { width: 4, height: 4, borderRadius: 2 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:{ fontSize: 15, fontWeight: '900' },

  urgentCard:  { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 10, elevation: 1 },
  urgentBadge: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  urgentDays:  { fontSize: 13, fontWeight: '900' },
  urgentTitle: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  urgentLabel: { fontSize: 11, fontWeight: '700' },

  legend:      { flexDirection: 'row', flexWrap: 'wrap', gap: 14, padding: 16, marginHorizontal: 16, marginBottom: 20, borderRadius: 16, elevation: 1 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendText:  { fontSize: 11, fontWeight: '600' },

  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, maxHeight: '75%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetTitle:  { fontSize: 18, fontWeight: '900', marginBottom: 16 },
  emptyDay:    { alignItems: 'center', paddingVertical: 30 },
  eventCard:   { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 10 },
  eventLeft:   { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center' },
  eventTitle:  { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  eventLabel:  { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  eventOrg:    { fontSize: 11, fontWeight: '600' },
  closeBtn:    { backgroundColor: '#002855', padding: 15, borderRadius: 14, alignItems: 'center', marginTop: 14 },
  closeBtnText:{ color: '#fff', fontWeight: '900', fontSize: 15 },
});

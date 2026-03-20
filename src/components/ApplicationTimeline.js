// ============================================================
// FILE: src/components/ApplicationTimeline.js
// Beautiful status timeline component
// ============================================================
import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// All possible steps in order
const ALL_STEPS = [
  {
    key:   'submitted',
    label: 'Application Submitted',
    sub:   'Your application has been received',
    icon:  'send-check',
    color: '#3B82F6',
  },
  {
    key:   'fee_verified',
    label: 'Payment Verified',
    sub:   'Your payment has been confirmed',
    icon:  'cash-check',
    color: '#8B5CF6',
  },
  {
    key:   'assigned',
    label: 'Agent Assigned',
    sub:   'A field agent is working on your form',
    icon:  'account-check',
    color: '#F59E0B',
  },
  {
    key:   'in_process',
    label: 'Form Processing',
    sub:   'Your application is being processed',
    icon:  'progress-wrench',
    color: '#EC4899',
  },
  {
    key:   'final_submit',
    label: 'Submitted to Portal',
    sub:   'Form submitted to government portal',
    icon:  'cloud-upload-check',
    color: '#10B981',
  },
  {
    key:   'completed',
    label: 'Completed',
    sub:   'Your application is complete!',
    icon:  'check-decagram',
    color: '#059669',
  },
];

// Map status string to step index
function getStepIndex(status, paymentMethod, paymentStatus) {
  const s = (status || '').toLowerCase();

  // Payment pending
  if (paymentMethod === 'upi' && (!paymentStatus || paymentStatus === 'pending')) {
    return 0; // submitted but fee not verified
  }

  if (s.includes('reject'))                        return -1; // rejected
  if (s === 'completed' || s === 'final submit' || s === 'submitted') return 5;
  if (s.includes('final'))                         return 4;
  if (s.includes('process'))                       return 3;
  if (s === 'assigned')                            return 2;
  if (s.includes('verif') || s.includes('fee'))   return 1;
  return 0;
};

export default function ApplicationTimeline({ app, theme }) {
  const isRejected = (app?.status || '').toLowerCase().includes('reject');
  const currentStep = getStepIndex(app?.status, app?.paymentMethod, app?.paymentStatus);

  // Animate each step
  const anims = useRef(ALL_STEPS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: i * 150,
        useNativeDriver: true,
      })
    );
    Animated.stagger(150, animations).start();
  }, []);

  if (isRejected) {
    return (
      <View style={[s.rejectedBox, { backgroundColor: '#FEF2F2' }]}>
        <View style={s.rejectedIcon}>
          <MaterialCommunityIcons name="close-circle" size={32} color="#EF4444" />
        </View>
        <Text style={s.rejectedTitle}>Application Rejected</Text>
        <Text style={s.rejectedSub}>
          {app?.rejectionReason || 'Please contact support for more details.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <Text style={[s.heading, { color: theme?.text || '#1E293B' }]}>
        Application Progress
      </Text>

      {ALL_STEPS.map((step, idx) => {
        const isDone    = idx <= currentStep;
        const isActive  = idx === currentStep;
        const isLast    = idx === ALL_STEPS.length - 1;

        return (
          <Animated.View
            key={step.key}
            style={[s.stepRow, {
              opacity:   anims[idx],
              transform: [{ translateX: anims[idx].interpolate({
                inputRange: [0, 1], outputRange: [-20, 0],
              }) }],
            }]}
          >
            {/* Left — icon + line */}
            <View style={s.leftCol}>
              {/* Icon circle */}
              <View style={[s.iconCircle, {
                backgroundColor: isDone  ? step.color : theme?.surface || '#F1F5F9',
                borderColor:     isActive ? step.color : isDone ? step.color : '#E2E8F0',
                borderWidth:     isActive ? 3 : 1.5,
              }]}>
                {isDone ? (
                  <MaterialCommunityIcons
                    name={isActive ? step.icon : 'check'}
                    size={isActive ? 16 : 14}
                    color="#fff"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name={step.icon}
                    size={14}
                    color="#CBD5E1"
                  />
                )}
              </View>

              {/* Connecting line */}
              {!isLast && (
                <View style={[s.line, {
                  backgroundColor: idx < currentStep ? step.color : '#E2E8F0',
                }]} />
              )}
            </View>

            {/* Right — content */}
            <View style={[s.content, { marginBottom: isLast ? 0 : 20 }]}>
              <View style={s.labelRow}>
                <Text style={[s.label, {
                  color:      isDone ? (theme?.text || '#1E293B') : '#94A3B8',
                  fontWeight: isActive ? '900' : '700',
                }]}>
                  {step.label}
                </Text>
                {isActive && (
                  <View style={[s.activeBadge, { backgroundColor: step.color + '20' }]}>
                    <Text style={[s.activeBadgeText, { color: step.color }]}>
                      Current
                    </Text>
                  </View>
                )}
                {isDone && !isActive && (
                  <MaterialCommunityIcons name="check-circle" size={14} color={step.color} />
                )}
              </View>
              <Text style={[s.sub, {
                color: isDone ? (theme?.textMuted || '#64748B') : '#CBD5E1',
              }]}>
                {step.sub}
              </Text>

              {/* Active step — pulsing indicator */}
              {isActive && (
                <View style={[s.activeBar, { backgroundColor: step.color }]} />
              )}
            </View>
          </Animated.View>
        );
      })}

      {/* Tracking ID */}
      <View style={[s.trackBox, { backgroundColor: theme?.surface || '#F8FAFC' }]}>
        <MaterialCommunityIcons name="identifier" size={14} color="#64748B" />
        <Text style={s.trackText}>Tracking ID: </Text>
        <Text style={s.trackId}>{app?.trackingId || '—'}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:            { paddingHorizontal: 4 },
  heading:         { fontSize: 15, fontWeight: '900', marginBottom: 20 },

  stepRow:         { flexDirection: 'row', gap: 14 },
  leftCol:         { alignItems: 'center', width: 36 },
  iconCircle:      { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  line:            { width: 2, flex: 1, minHeight: 24, marginTop: 4, borderRadius: 1 },

  content:         { flex: 1, paddingTop: 6 },
  labelRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  label:           { fontSize: 13 },
  sub:             { fontSize: 11, fontWeight: '600', lineHeight: 16 },
  activeBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  activeBadgeText: { fontSize: 10, fontWeight: '900' },
  activeBar:       { height: 3, width: 40, borderRadius: 2, marginTop: 6, opacity: 0.6 },

  trackBox:        { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 12, borderRadius: 12, marginTop: 16 },
  trackText:       { fontSize: 11, color: '#64748B', fontWeight: '700' },
  trackId:         { fontSize: 12, color: '#002855', fontWeight: '900', letterSpacing: 0.5 },

  rejectedBox:     { borderRadius: 20, padding: 24, alignItems: 'center', marginTop: 8 },
  rejectedIcon:    { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  rejectedTitle:   { fontSize: 16, fontWeight: '900', color: '#DC2626', marginBottom: 6 },
  rejectedSub:     { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },
});

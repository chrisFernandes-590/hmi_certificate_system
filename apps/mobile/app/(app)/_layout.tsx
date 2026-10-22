import React from 'react'
import { Redirect, Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/auth'
import { Loader } from '@/components/ui'
import { colors } from '@/lib/design'

type IoniconsName = keyof typeof Ionicons.glyphMap

function tabBarIcon(name: IoniconsName, focused: boolean) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconsName)}
      size={24}
      color={focused ? colors.accent : colors.textMuted}
    />
  )
}

export default function AppLayout() {
  const { user, loading } = useAuth()

  if (loading) return <Loader text="Restoring session…" />
  if (!user) return <Redirect href="/(auth)/login" />

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.bgCard },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => tabBarIcon('home', focused),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ focused }) => tabBarIcon('calendar', focused),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="my-events"
        options={{
          title: 'My Events',
          tabBarLabel: 'Registered',
          tabBarIcon: ({ focused }) => tabBarIcon('bookmark', focused),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="certificates"
        options={{
          title: 'Certificates',
          tabBarIcon: ({ focused }) => tabBarIcon('ribbon', focused),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => tabBarIcon('person', focused),
        }}
      />
    </Tabs>
  )
}

{{/*
Expand the name of the chart.
*/}}
{{- define "kyntra.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "kyntra.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart label.
*/}}
{{- define "kyntra.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "kyntra.labels" -}}
helm.sh/chart: {{ include "kyntra.chart" . }}
app.kubernetes.io/name: {{ include "kyntra.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "kyntra.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kyntra.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Database URL.
*/}}
{{- define "kyntra.databaseUrl" -}}
{{- if .Values.postgresql.enabled -}}
postgresql://{{ .Values.postgresql.auth.username }}:{{ .Values.postgresql.auth.password }}@{{ include "kyntra.fullname" . }}-postgresql:5432/{{ .Values.postgresql.auth.database }}
{{- else -}}
{{- required "External database URL required when postgresql.enabled=false" .Values.externalDatabase.url -}}
{{- end }}
{{- end }}

{{/*
Redis URL.
*/}}
{{- define "kyntra.redisUrl" -}}
{{- if .Values.redis.enabled -}}
redis://{{ include "kyntra.fullname" . }}-redis-master:6379
{{- else -}}
{{- required "External Redis URL required when redis.enabled=false" .Values.externalRedis.url -}}
{{- end }}
{{- end }}

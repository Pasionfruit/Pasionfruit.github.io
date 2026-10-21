import SwiftUI
import WidgetKit

// Today's training plan on the iPhone lock screen. It reads the same public
// endpoint the site uses (training_records on the db Worker), so no token is
// stored on the phone. Workout text follows the format in src/training/workoutPlan.ts.

private let plansURL = URL(string: "https://db.abepasion.workers.dev/db/training_records")!
private let refreshInterval: TimeInterval = 2 * 60 * 60

// MARK: - Data

private struct TrainingRecord: Decodable {
    let date: String?
    let morning_workout: String?
    let evening_workout: String?
}

private struct TrainingResponse: Decodable {
    let rows: [TrainingRecord]
}

struct TrainingSession: Identifiable {
    let label: String
    let lines: [String]
    var id: String { label }
}

struct TrainingEntry: TimelineEntry {
    enum State { case loaded, noRecord, failed }

    let date: Date
    let state: State
    let morning: String
    let evening: String

    var sessions: [TrainingSession] {
        [
            TrainingSession(label: "AM", lines: workoutLines(morning)),
            TrainingSession(label: "PM", lines: workoutLines(evening)),
        ]
        .filter { !$0.lines.isEmpty }
    }

    var isRestDay: Bool {
        let all = sessions.flatMap { $0.lines }
        return all.count == 1 && all[0].lowercased() == "rest day"
    }

    static let sample = TrainingEntry(
        date: .now,
        state: .loaded,
        morning: "**Easy swim**\n• 100m breast\n• 4×50m free",
        evening: "**Legs**\n• Squats 4×8\n• Lunges 3×10"
    )
}

/// Same rules as workoutLines() in the site: one line per row, a leading
/// "• ", "- " or "* " marks a bullet, and **bold** markers are dropped.
func workoutLines(_ text: String) -> [String] {
    text.components(separatedBy: .newlines).compactMap { raw in
        var line = raw.trimmingCharacters(in: .whitespaces)
        for bullet in ["• ", "- ", "* "] where line.hasPrefix(bullet) {
            line = String(line.dropFirst(bullet.count))
            break
        }
        line = line.replacingOccurrences(of: "**", with: "").trimmingCharacters(in: .whitespaces)
        return line.isEmpty ? nil : line
    }
}

private func pad(_ value: Int) -> String {
    value < 10 ? "0\(value)" : "\(value)"
}

/// Local calendar day as YYYY-MM-DD, the key the site matches records on.
private func dayKey(_ date: Date) -> String {
    let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
    return "\(parts.year ?? 0)-\(pad(parts.month ?? 0))-\(pad(parts.day ?? 0))"
}

/// Accepts "YYYY-MM-DD" (optionally with a time), "M/D/YYYY", or a full ISO timestamp.
private func rowDayKey(_ raw: String?) -> String? {
    guard let value = raw?.trimmingCharacters(in: .whitespaces), !value.isEmpty else { return nil }

    if value.range(of: #"^\d{4}-\d{2}-\d{2}"#, options: .regularExpression) != nil {
        return String(value.prefix(10))
    }

    let slashParts = value.split(separator: "/")
    if slashParts.count == 3, let month = Int(slashParts[0]), let day = Int(slashParts[1]), let year = Int(slashParts[2]) {
        return "\(year)-\(pad(month))-\(pad(day))"
    }

    if let date = ISO8601DateFormatter().date(from: value) {
        return dayKey(date)
    }
    return nil
}

enum TrainingLoader {
    static func load(now: Date = .now) async -> TrainingEntry {
        do {
            let (data, response) = try await URLSession.shared.data(from: plansURL)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return failed(now) }

            let rows = try JSONDecoder().decode(TrainingResponse.self, from: data).rows
            let today = dayKey(now)
            guard let row = rows.first(where: { rowDayKey($0.date) == today }) else {
                return TrainingEntry(date: now, state: .noRecord, morning: "", evening: "")
            }
            return TrainingEntry(
                date: now,
                state: .loaded,
                morning: row.morning_workout ?? "",
                evening: row.evening_workout ?? ""
            )
        } catch {
            return failed(now)
        }
    }

    private static func failed(_ now: Date) -> TrainingEntry {
        TrainingEntry(date: now, state: .failed, morning: "", evening: "")
    }
}

// MARK: - Timeline

struct TrainingProvider: TimelineProvider {
    func placeholder(in context: Context) -> TrainingEntry {
        .sample
    }

    func getSnapshot(in context: Context, completion: @escaping (TrainingEntry) -> Void) {
        if context.isPreview {
            completion(.sample)
            return
        }
        Task { completion(await TrainingLoader.load()) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TrainingEntry>) -> Void) {
        Task {
            let entry = await TrainingLoader.load()
            // Refresh every two hours, but never later than just after midnight,
            // so yesterday's plan does not linger into the new day.
            let nextMidnight = Calendar.current.startOfDay(for: .now).addingTimeInterval(24 * 3600 + 300)
            let nextRefresh = min(Date.now.addingTimeInterval(refreshInterval), nextMidnight)
            completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
        }
    }
}

// MARK: - Views

struct TrainingWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TrainingEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            Text("Train: \(headline)")
                .lineLimit(1)
        default:
            rectangular
        }
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Today's training")
                .font(.caption2.weight(.semibold))
                .widgetAccentable()

            if entry.state == .loaded, !entry.isRestDay, !entry.sessions.isEmpty {
                ForEach(entry.sessions) { session in
                    Text("\(session.label)  \(session.lines.joined(separator: " · "))")
                        .font(.caption)
                }
            } else {
                Text(headline)
                    .font(.caption)
            }
        }
        .lineLimit(1)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// One line for the whole day, e.g. "AM Easy swim · PM Legs".
    private var headline: String {
        switch entry.state {
        case .failed:
            return "Couldn't load plan"
        case .noRecord:
            return "No workout scheduled"
        case .loaded:
            if entry.isRestDay { return "Rest day" }
            let parts = entry.sessions.map { "\($0.label) \($0.lines.first ?? "")" }
            return parts.isEmpty ? "No workout scheduled" : parts.joined(separator: " · ")
        }
    }
}

// MARK: - Widget

struct TrainingWidget: Widget {
    let kind = "TrainingWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TrainingProvider()) { entry in
            TrainingWidgetView(entry: entry)
                .containerBackground(for: .widget) { Color.clear }
        }
        .configurationDisplayName("Today's Training")
        .description("Today's planned workouts on your lock screen.")
        .supportedFamilies([.accessoryRectangular, .accessoryInline])
    }
}

@main
struct TrainingWidgetBundle: WidgetBundle {
    var body: some Widget {
        TrainingWidget()
    }
}

#Preview(as: .accessoryRectangular) {
    TrainingWidget()
} timeline: {
    TrainingEntry.sample
}

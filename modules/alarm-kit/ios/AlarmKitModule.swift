// Apple's framework. This resolves unambiguously only because the surrounding
// pod is named AnimsaAlarmKit rather than AlarmKit.
import AlarmKit
import ExpoModulesCore
import SwiftUI

/// AlarmKit requires the caller to supply a metadata type; the app stores
/// nothing extra, so this is deliberately empty.
struct AnimsaAlarmMetadata: AlarmMetadata {
  init() {}
}

public class AlarmKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AlarmKit")

    Function("isAvailable") { () -> Bool in
      true
    }

    Function("getAuthorizationState") { () -> String in
      Self.map(AlarmManager.shared.authorizationState)
    }

    AsyncFunction("requestAuthorization") { () async throws -> String in
      Self.map(try await AlarmManager.shared.requestAuthorization())
    }

    AsyncFunction("scheduleFixed") { (id: String, epochMs: Double, title: String) async throws in
      let date = Date(timeIntervalSince1970: epochMs / 1000)
      let config = Self.config(schedule: .fixed(date), title: title)
      _ = try await AlarmManager.shared.schedule(id: try Self.uuid(id), configuration: config)
    }

    AsyncFunction("scheduleWeekly") {
      (id: String, hour: Int, minute: Int, weekdays: [Int], title: String) async throws in
      let days = weekdays.compactMap(Self.weekday)
      guard !days.isEmpty else {
        throw Exception(name: "AlarmKitError", description: "En az bir gün gerekli")
      }
      let time = Alarm.Schedule.Relative.Time(hour: hour, minute: minute)
      let relative = Alarm.Schedule.Relative(time: time, repeats: .weekly(days))
      let config = Self.config(schedule: .relative(relative), title: title)
      _ = try await AlarmManager.shared.schedule(id: try Self.uuid(id), configuration: config)
    }

    AsyncFunction("cancel") { (id: String) throws in
      try AlarmManager.shared.cancel(id: try Self.uuid(id))
    }

    AsyncFunction("listIds") { () throws -> [String] in
      try AlarmManager.shared.alarms.map { $0.id.uuidString.lowercased() }
    }

    AsyncFunction("cancelAll") { () throws in
      for alarm in try AlarmManager.shared.alarms {
        try? AlarmManager.shared.cancel(id: alarm.id)
      }
    }
  }

  // MARK: - Helpers

  /// Builds the alert presentation shared by every alarm the app schedules.
  /// Snooze is intentionally absent: a countdown presentation would require a
  /// Live Activity extension, and extensions are out of scope on a free
  /// signing account.
  static func config(schedule: Alarm.Schedule, title: String)
    -> AlarmManager.AlarmConfiguration<AnimsaAlarmMetadata>
  {
    let stop = AlarmButton(text: "Durdur", textColor: .white, systemImageName: "stop.fill")
    let alert = AlarmPresentation.Alert(
      title: LocalizedStringResource(stringLiteral: title),
      stopButton: stop
    )
    let attributes = AlarmAttributes<AnimsaAlarmMetadata>(
      presentation: AlarmPresentation(alert: alert),
      metadata: AnimsaAlarmMetadata(),
      tintColor: Color.orange
    )
    return AlarmManager.AlarmConfiguration(
      schedule: schedule,
      attributes: attributes,
      stopIntent: nil,
      secondaryIntent: nil,
      sound: .default
    )
  }

  static func uuid(_ raw: String) throws -> UUID {
    guard let value = UUID(uuidString: raw) else {
      throw Exception(name: "AlarmKitError", description: "Geçersiz alarm kimliği: \(raw)")
    }
    return value
  }

  /// Maps the app's ISO weekday numbering (1 = Monday … 7 = Sunday).
  static func weekday(_ value: Int) -> Locale.Weekday? {
    switch value {
    case 1: return .monday
    case 2: return .tuesday
    case 3: return .wednesday
    case 4: return .thursday
    case 5: return .friday
    case 6: return .saturday
    case 7: return .sunday
    default: return nil
    }
  }

  static func map(_ state: AlarmManager.AuthorizationState) -> String {
    switch state {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default: return "unavailable"
    }
  }
}

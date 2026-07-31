package expo.modules.playgames

import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Thin bridge over the Google Play Games Services **v2** SDK.
 *
 * Exposed to JS as the native module "PlayGames" and consumed by
 * `utils/playGames.ts` via `requireNativeModule("PlayGames")`. Android-only:
 * on iOS/web/Expo Go the module isn't present and the JS wrapper no-ops.
 *
 * Contract: every method is defensive. When there's no current Activity (app
 * backgrounded, etc.) sign-in resolves false and the fire-and-forget calls
 * resolve without throwing, so a PGS hiccup never breaks the local (offline)
 * achievement flow that drives these calls.
 */
class PlayGamesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PlayGames")

    OnCreate {
      // v2 also auto-initializes from the APP_ID manifest metadata, but calling
      // this explicitly is safe and makes intent clear. Guarded: initialize()
      // throws IllegalStateException when the APP_ID meta-data is missing
      // (e.g. a build without the withPlayGames config plugin applied), and an
      // OnCreate throw would be an uncaught native exception at startup.
      try {
        appContext.reactContext?.let { PlayGamesSdk.initialize(it) }
      } catch (_: Exception) {
        // PGS stays uninitialized; later client calls fail into rejected
        // promises which the JS wrapper swallows. Never crash launch.
      }
    }

    AsyncFunction("isAuthenticated") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      PlayGames.getGamesSignInClient(activity).isAuthenticated
        .addOnCompleteListener { task ->
          promise.resolve(task.isSuccessful && task.result?.isAuthenticated == true)
        }
    }

    AsyncFunction("signInSilently") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      // Truly silent: only read the automatic sign-in result. Never call the
      // interactive signIn() here — this runs on every app launch, and users
      // who declined Play Games must not get a prompt on each cold start.
      // (An interactive flow, if ever wanted, belongs behind an explicit
      // user-initiated button wired to a separate method.)
      PlayGames.getGamesSignInClient(activity).isAuthenticated
        .addOnCompleteListener { task ->
          promise.resolve(task.isSuccessful && task.result?.isAuthenticated == true)
        }
    }

    AsyncFunction("unlockAchievement") { playId: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      // unlock() is fire-and-forget on the SDK side; it silently no-ops if the
      // player isn't signed in, so we don't gate on auth here.
      PlayGames.getAchievementsClient(activity).unlock(playId)
      promise.resolve(null)
    }

    AsyncFunction("incrementAchievement") { playId: String, steps: Int, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      PlayGames.getAchievementsClient(activity).increment(playId, steps)
      promise.resolve(null)
    }

    AsyncFunction("showAchievements") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      PlayGames.getAchievementsClient(activity).achievementsIntent
        .addOnSuccessListener { intent ->
          // Listener bodies aren't promise-wrapped by the module DSL, so a
          // throw here (e.g. finishing/destroyed activity) must be caught to
          // avoid an uncaught main-thread exception.
          try {
            activity.startActivity(intent)
            promise.resolve(null)
          } catch (e: Exception) {
            promise.reject(
              "ERR_SHOW_ACHIEVEMENTS",
              e.message ?: "Failed to open the Play Games achievements overlay",
              e,
            )
          }
        }
        .addOnFailureListener { e ->
          promise.reject(
            "ERR_SHOW_ACHIEVEMENTS",
            e.message ?: "Failed to open the Play Games achievements overlay",
            e,
          )
        }
    }
  }
}

import {ChangeDetectionStrategy, Component} from "@angular/core";
import {ConfigService} from "../../core/basics/config.service";
import {Observable} from "rxjs";
import {Config} from "../../shared/model/config/config.model";
import {Hint} from "../../shared/model/messages/interfaces/requests/query-config.interface";
import {MatSlideToggleChange} from "@angular/material";
import {first, map} from "rxjs/operators";

@Component({
    moduleId: module.id,
    selector: 'preferences',
    templateUrl: './preferences.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreferencesComponent {

    /** The current configuration as observable. */
    private _config: Observable<Config>;

    /**
     * Constructor for PreferencesComponent
     */
    constructor(private _configService: ConfigService) {
        this._config = this._configService.asObservable();
    }

    /**
     *
     */
    public onResetButtonClicked() {
        this._configService.reset();
    }

    /**
     * Triggered whenever the user changes the value of the UseInexactIndex setting.
     *
     * @param {MatSlideToggleChange} e The associated change event.
     */
    public onUseInexactIndexChanged(e: MatSlideToggleChange) {
        this._config.pipe(first()).subscribe(c => {
            let hints = c.get<Hint[]>('query.config.hints').filter(h => ["inexact", "exact"].indexOf(h) == -1);
            if (e.checked == true) {
                hints.push("inexact");
            } else {
                hints.push("exact");
            }
            c.set('query.config.hints', hints);
            this._configService.apply(c);
        });
    }

    /**
     * Getter for Cineast endpoint
     *
     * @return {Observable<string>}
     */
    get cineastEndpoint(): Observable<string> {
        return this._config.pipe(map(c => c.endpoint_ws));
    }

    /**
     * Getter for thumbnail host.
     *
     * @return {Observable<string>}
     */
    get hostThumbnails(): Observable<string> {
        return this._config.pipe(map(c => c.get<string>('resources.host_thumbnails')));
    }

    /**
     * Getter for media object host
     *
     * @return {Observable<string>}
     */
    get hostObjects(): Observable<string> {
        return this._config.pipe(map(c => c.get<string>('resources.host_objects')));
    }

    /**
     * Getter for whether or not the inexact-hint in the current QueryConfig is active.
     *
     * @return {Observable<boolean>}
     */
    get useInexactIndex(): Observable<boolean> {
        return this._config.pipe(
            map(c => c.get<Hint[]>('query.config.hints')),
            map(h => h.indexOf("inexact") > -1 && h.indexOf("exact") == -1)
        );
    }
}
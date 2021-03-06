import {Component} from '@angular/core';
import {QueryChange, QueryService,} from "./core/queries/query.service";
import {ConfigService} from "./core/basics/config.service";
import {Config} from "./shared/model/config/config.model";
import {Observable} from "rxjs";
import {EventBusService} from "./core/basics/event-bus.service";
import {filter, map} from "rxjs/operators";
import {MatBottomSheet} from "@angular/material";
import {HistoryComponent} from "./results/history.component";
@Component({
    moduleId: module.id,
    selector: 'vitrivr',
    templateUrl: 'app.component.html',
    styleUrls: ['./app.component.css'],
})
export class AppComponent {
    /** Observable that returns the most recent application configuration. */
    private _config: Observable<Config>;

    /** Observable that return the loading state of the QueryService. */
    private _loading: Observable<boolean>;

    /**
     * Default constructor. Subscribe for PING messages at the CineastWebSocketFactoryService.
     *
     * @param _queryService Reference to the singleton QueryService.
     * @param _configService Reference to the singleton ConfigService.
     * @param _eventBusService Reference to the singleton EventBusService.
     */
    constructor(_queryService : QueryService, _configService: ConfigService, private _eventBusService: EventBusService, private _bottomSheet: MatBottomSheet) {
        this._loading = _queryService.observable.pipe(
            filter(msg => ["STARTED","ENDED","ERROR"].indexOf(msg) > -1),
            map((msg: QueryChange) => {
                return _queryService.running;
            })
        );
        this._config = _configService.asObservable();
    }

    /**
     * Getter for the observable config attribute.
     *
     * @return {Observable<Config>}
     */
    get config(): Observable<Config> {
        return this._config;
    }

    /**
     * Getter for the observable loading attribute.
     *
     * @return {Observable<boolean>}
     */
    get loading(): Observable<boolean> {
        return this._loading;
    }

    /**
     * Displays the query history panel.
     */
    public showHistory() {
        this._bottomSheet.open(HistoryComponent, {
            ariaLabel: 'Show query history.'
        });
    }
}
